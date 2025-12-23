import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq, and, type SQL } from 'drizzle-orm';

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
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const warehouseId = searchParams.get('warehouseId');
    const itemType = searchParams.get('itemType');

    // Get the appropriate schema tables
    const itemsTable = getTableRef('items');
    const lotsTable = getTableRef('inventoryLots');
    const warehousesTable = getTableRef('warehouses');

    // Build conditions
    const conditions: (SQL | undefined)[] = [];

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
    const results = await executeDbOperation(async (db) => {
      return db
        .select({
          lotNumber: lotsTable.lotNumber,
          itemCode: itemsTable.code,
          itemName: itemsTable.nameTh,
          itemNameEn: itemsTable.nameEn,
          itemType: itemsTable.type,
          status: lotsTable.status,
          quantity: lotsTable.quantity,
          unit: itemsTable.primaryUnit,
          manufacturingDate: lotsTable.manufacturingDate,
          expiryDate: lotsTable.expiryDate,
          warehouseCode: warehousesTable.code,
          warehouseName: warehousesTable.name,
          receivedDate: lotsTable.receivedDate,
        })
        .from(lotsTable)
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(lotsTable.expiryDate);
    });

    // Calculate days to expiry and format data
    const today = new Date();
    const lotStatusData = results.map((row: {
      lotNumber: string;
      itemCode: string;
      itemName: string;
      itemNameEn: string | null;
      itemType: string;
      status: string;
      quantity: number | string;
      unit: string;
      manufacturingDate: string | null;
      expiryDate: string | null;
      warehouseCode: string;
      warehouseName: string;
      receivedDate: string | null;
    }) => {
      const expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
      const daysToExpiry = expiryDate
        ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const qty = typeof row.quantity === 'string' ? parseFloat(row.quantity) : row.quantity;

      return {
        lotNumber: row.lotNumber,
        itemCode: row.itemCode,
        itemName: row.itemName,
        itemNameEn: row.itemNameEn,
        itemType: row.itemType,
        status: row.status,
        quantity: qty,
        unit: row.unit,
        manufacturingDate: row.manufacturingDate,
        expiryDate: row.expiryDate,
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

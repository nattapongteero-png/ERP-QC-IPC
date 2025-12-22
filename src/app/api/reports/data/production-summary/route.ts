import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/data/production-summary
 * Returns production summary data for reporting
 * Query params:
 *   - startDate: Start date filter
 *   - endDate: End date filter
 *   - status: Optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const usingSqlite = isSqlite();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    // Get the appropriate schema tables
    const itemsTable = usingSqlite ? schema.sqliteItems : schema.mysqlItems;
    const workOrdersTable = usingSqlite ? schema.sqliteWorkOrders : schema.mysqlWorkOrders;
    const bomTable = usingSqlite ? schema.sqliteBOM : schema.mysqlBOM;

    // Build conditions
    const conditions = [];

    if (startDate) {
      conditions.push(gte(workOrdersTable.plannedStartDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(workOrdersTable.plannedStartDate, endDate));
    }

    if (status) {
      conditions.push(eq(workOrdersTable.status, status));
    }

    // Query work orders with product details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (db as any)
      .select({
        woNumber: workOrdersTable.woNumber,
        productCode: itemsTable.code,
        productName: itemsTable.nameTh,
        productNameEn: itemsTable.nameEn,
        bomCode: bomTable.code,
        bomName: bomTable.name,
        plannedQuantity: workOrdersTable.plannedQuantity,
        actualQuantity: workOrdersTable.actualQuantity,
        status: workOrdersTable.status,
        priority: workOrdersTable.priority,
        plannedStartDate: workOrdersTable.plannedStartDate,
        plannedEndDate: workOrdersTable.plannedEndDate,
        actualStartDate: workOrdersTable.actualStartDate,
        actualEndDate: workOrdersTable.actualEndDate,
        batchNumber: workOrdersTable.batchNumber,
      })
      .from(workOrdersTable)
      .innerJoin(bomTable, eq(workOrdersTable.bomId, bomTable.id))
      .innerJoin(itemsTable, eq(bomTable.productId, itemsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(workOrdersTable.plannedStartDate);

    // Calculate yield percentage and format data
    const productionData = results.map((row: {
      woNumber: string;
      productCode: string;
      productName: string;
      productNameEn: string | null;
      bomCode: string;
      bomName: string;
      plannedQuantity: number | string;
      actualQuantity: number | string | null;
      status: string;
      priority: number;
      plannedStartDate: string;
      plannedEndDate: string;
      actualStartDate: string | null;
      actualEndDate: string | null;
      batchNumber: string | null;
    }) => {
      const plannedQty = typeof row.plannedQuantity === 'string' ? parseFloat(row.plannedQuantity) : (row.plannedQuantity || 0);
      const actualQty = row.actualQuantity ? (typeof row.actualQuantity === 'string' ? parseFloat(row.actualQuantity) : row.actualQuantity) : 0;
      const yieldPercentage = plannedQty > 0 ? (actualQty / plannedQty) * 100 : 0;

      return {
        workOrderNumber: row.woNumber,
        productCode: row.productCode,
        productName: row.productName,
        productNameEn: row.productNameEn,
        bomCode: row.bomCode,
        bomName: row.bomName,
        plannedQuantity: plannedQty,
        completedQuantity: actualQty,
        yieldPercentage: Math.round(yieldPercentage * 100) / 100,
        status: row.status,
        priority: row.priority,
        plannedStartDate: row.plannedStartDate,
        plannedEndDate: row.plannedEndDate,
        actualStartDate: row.actualStartDate,
        actualEndDate: row.actualEndDate,
        batchNumber: row.batchNumber,
        isOnTime: !row.actualEndDate || new Date(row.actualEndDate) <= new Date(row.plannedEndDate),
        isOverdue: row.status !== 'completed' && new Date() > new Date(row.plannedEndDate),
      };
    });

    // Calculate summary by status
    const statusSummary = productionData.reduce((acc: Record<string, number>, wo: { status: string }) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1;
      return acc;
    }, {});

    const completedOrders = productionData.filter((wo: { status: string }) => wo.status === 'completed');
    const averageYield = completedOrders.length > 0
      ? completedOrders.reduce((sum: number, wo: { yieldPercentage: number }) => sum + wo.yieldPercentage, 0) / completedOrders.length
      : 0;

    const summary = {
      totalWorkOrders: productionData.length,
      statusCounts: statusSummary,
      totalPlannedQuantity: productionData.reduce((sum: number, wo: { plannedQuantity: number }) => sum + wo.plannedQuantity, 0),
      totalCompletedQuantity: productionData.reduce((sum: number, wo: { completedQuantity: number }) => sum + wo.completedQuantity, 0),
      averageYieldPercentage: Math.round(averageYield * 100) / 100,
      onTimeCount: productionData.filter((wo: { isOnTime: boolean; status: string }) => wo.isOnTime && wo.status === 'completed').length,
      overdueCount: productionData.filter((wo: { isOverdue: boolean }) => wo.isOverdue).length,
      dateRange: { startDate, endDate },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: productionData,
      summary,
    });
  } catch (error) {
    console.error('Production summary report error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate production summary report' },
      { status: 500 }
    );
  }
}

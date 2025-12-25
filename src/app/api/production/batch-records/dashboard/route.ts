/**
 * Batch Records Dashboard API
 * Feature: Production Management
 *
 * GET /api/production/batch-records/dashboard - Get comprehensive eBMR dashboard data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteBatchRecords,
  sqliteWorkOrders,
  sqliteItems,
  sqliteOperations,
} from '@/lib/db/schema';
import { eq, count, sql, gte, lte, and } from 'drizzle-orm';
import { toQueryDate, getTodayStr } from '@/lib/db/date-utils';

export interface BatchRecordsDashboard {
  totalRecords: number;
  pendingRecords: number;
  inProgressRecords: number;
  completedRecords: number;
  deviationRecords: number;
  completedToday: number;
  avgCompletionTime: number | null;
  byStatus: Record<string, number>;
  byOperation: Array<{
    operationId: number;
    operationName: string;
    recordCount: number;
    completedCount: number;
  }>;
  topProducts: Array<{
    productId: number;
    productName: string;
    productCode: string;
    recordCount: number;
    completionRate: number;
  }>;
  recentActivity: Array<{
    date: string;
    completed: number;
    deviations: number;
  }>;
  recentRecords: Array<{
    id: number;
    woNumber: string;
    batchNumber: string;
    productName: string;
    stepName: string;
    status: string;
    startTime: string | null;
  }>;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const database = (await getDb()) as any;

    const today = new Date();
    const todayStr = getTodayStr();

    // Get record counts by status
    const statusResult = await database
      .select({
        status: sqliteBatchRecords.status,
        count: count(),
      })
      .from(sqliteBatchRecords)
      .groupBy(sqliteBatchRecords.status);

    const byStatus: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      deviation: 0,
    };
    let totalRecords = 0;
    let pendingRecords = 0;
    let inProgressRecords = 0;
    let completedRecords = 0;
    let deviationRecords = 0;

    for (const row of statusResult) {
      byStatus[row.status] = row.count;
      totalRecords += row.count;
      if (row.status === 'pending') pendingRecords = row.count;
      if (row.status === 'in_progress') inProgressRecords = row.count;
      if (row.status === 'completed') completedRecords = row.count;
      if (row.status === 'deviation') deviationRecords = row.count;
    }

    // Get records completed today
    const completedTodayResult = await database
      .select({ count: count() })
      .from(sqliteBatchRecords)
      .where(
        and(
          eq(sqliteBatchRecords.status, 'completed'),
          gte(sqliteBatchRecords.endTime, todayStr as string)
        )
      );
    const completedToday = completedTodayResult[0]?.count || 0;

    // Get average completion time (in minutes)
    // SQLite uses julianday, MySQL uses TIMESTAMPDIFF
    const avgTimeSql = isSqlite()
      ? sql`AVG((julianday(${sqliteBatchRecords.endTime}) - julianday(${sqliteBatchRecords.startTime})) * 24 * 60)`
      : sql`AVG(TIMESTAMPDIFF(MINUTE, ${sqliteBatchRecords.startTime}, ${sqliteBatchRecords.endTime}))`;

    const avgTimeResult = await database
      .select({
        avgTime: avgTimeSql,
      })
      .from(sqliteBatchRecords)
      .where(
        and(
          eq(sqliteBatchRecords.status, 'completed'),
          sql`${sqliteBatchRecords.startTime} IS NOT NULL`,
          sql`${sqliteBatchRecords.endTime} IS NOT NULL`
        )
      );
    const avgCompletionTime = avgTimeResult[0]?.avgTime
      ? Math.round(avgTimeResult[0].avgTime)
      : null;

    // Get records by operation
    const operationResult = await database
      .select({
        operationId: sqliteBatchRecords.operationId,
        operationName: sqliteOperations.name,
        status: sqliteBatchRecords.status,
        count: count(),
      })
      .from(sqliteBatchRecords)
      .leftJoin(sqliteOperations, eq(sqliteBatchRecords.operationId, sqliteOperations.id))
      .groupBy(sqliteBatchRecords.operationId, sqliteBatchRecords.status);

    const operationMap = new Map<
      number,
      { operationId: number; operationName: string; recordCount: number; completedCount: number }
    >();

    for (const row of operationResult) {
      if (!row.operationId) continue;
      if (!operationMap.has(row.operationId)) {
        operationMap.set(row.operationId, {
          operationId: row.operationId,
          operationName: row.operationName || 'Unknown',
          recordCount: 0,
          completedCount: 0,
        });
      }
      const op = operationMap.get(row.operationId)!;
      op.recordCount += row.count;
      if (row.status === 'completed') {
        op.completedCount += row.count;
      }
    }

    const byOperation = Array.from(operationMap.values())
      .sort((a, b) => b.recordCount - a.recordCount)
      .slice(0, 8);

    // Get top products by record count
    const productResult = await database
      .select({
        productId: sqliteWorkOrders.productId,
        productName: sqliteItems.nameTh,
        productCode: sqliteItems.code,
        status: sqliteBatchRecords.status,
        count: count(),
      })
      .from(sqliteBatchRecords)
      .leftJoin(sqliteWorkOrders, eq(sqliteBatchRecords.workOrderId, sqliteWorkOrders.id))
      .leftJoin(sqliteItems, eq(sqliteWorkOrders.productId, sqliteItems.id))
      .groupBy(sqliteWorkOrders.productId, sqliteBatchRecords.status);

    const productMap = new Map<
      number,
      {
        productId: number;
        productName: string;
        productCode: string;
        recordCount: number;
        completedCount: number;
      }
    >();

    for (const row of productResult) {
      if (!row.productId) continue;
      if (!productMap.has(row.productId)) {
        productMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName || 'Unknown',
          productCode: row.productCode || 'N/A',
          recordCount: 0,
          completedCount: 0,
        });
      }
      const product = productMap.get(row.productId)!;
      product.recordCount += row.count;
      if (row.status === 'completed') {
        product.completedCount += row.count;
      }
    }

    const topProducts = Array.from(productMap.values())
      .map((p) => ({
        ...p,
        completionRate: p.recordCount > 0 ? Math.round((p.completedCount / p.recordCount) * 100) : 0,
      }))
      .sort((a, b) => b.recordCount - a.recordCount)
      .slice(0, 6);

    // Get recent activity (last 7 days)
    const recentActivity: Array<{ date: string; completed: number; deviations: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      const dayLabel = date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });

      const completedResult = await database
        .select({ count: count() })
        .from(sqliteBatchRecords)
        .where(
          and(
            eq(sqliteBatchRecords.status, 'completed'),
            gte(sqliteBatchRecords.endTime, dateStr),
            lte(sqliteBatchRecords.endTime, nextDateStr)
          )
        );

      const deviationResult = await database
        .select({ count: count() })
        .from(sqliteBatchRecords)
        .where(
          and(
            eq(sqliteBatchRecords.status, 'deviation'),
            gte(sqliteBatchRecords.updatedAt, dateStr),
            lte(sqliteBatchRecords.updatedAt, nextDateStr)
          )
        );

      recentActivity.push({
        date: dayLabel,
        completed: completedResult[0]?.count || 0,
        deviations: deviationResult[0]?.count || 0,
      });
    }

    // Get recent records
    const recentRecordsResult = await database
      .select({
        id: sqliteBatchRecords.id,
        woNumber: sqliteWorkOrders.woNumber,
        batchNumber: sqliteWorkOrders.batchNumber,
        productName: sqliteItems.nameTh,
        stepName: sqliteBatchRecords.stepName,
        status: sqliteBatchRecords.status,
        startTime: sqliteBatchRecords.startTime,
      })
      .from(sqliteBatchRecords)
      .leftJoin(sqliteWorkOrders, eq(sqliteBatchRecords.workOrderId, sqliteWorkOrders.id))
      .leftJoin(sqliteItems, eq(sqliteWorkOrders.productId, sqliteItems.id))
      .orderBy(sql`${sqliteBatchRecords.createdAt} DESC`)
      .limit(8);

    const dashboard: BatchRecordsDashboard = {
      totalRecords,
      pendingRecords,
      inProgressRecords,
      completedRecords,
      deviationRecords,
      completedToday,
      avgCompletionTime,
      byStatus,
      byOperation,
      topProducts,
      recentActivity,
      recentRecords: recentRecordsResult,
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching batch records dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

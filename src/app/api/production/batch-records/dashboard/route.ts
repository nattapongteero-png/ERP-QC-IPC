/**
 * Batch Records (eBMR) Dashboard API
 * Feature: Production Management
 *
 * GET /api/production/batch-records/dashboard
 * Aggregates execution data from wo_* tables (SOP, Cleaning, Environmental, Finished Inspection)
 * since batch_records table is not used by the execution workflow.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eq, count, inArray } from 'drizzle-orm';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

export interface BatchRecordsDashboard {
  totalRecords: number;
  pendingRecords: number;
  inProgressRecords: number;
  completedRecords: number;
  deviationRecords: number;
  completedToday: number;
  /** Average production time in HOURS across completed WOs with start+end; null if none. */
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

    const workOrders = getTableRef('workOrders');
    const items = getTableRef('items');
    const woSOPExecution = getTableRef('wOSOPExecution');
    const woCleaningLogs = getTableRef('wOCleaningLogs');
    const woEnvironmentalLogs = getTableRef('wOEnvironmentalLogs');
    const woFinishedInspection = getTableRef('wOFinishedInspection');

    // Step 1: Get all unique WO IDs that have any execution data
    const [sopWoIds, cleanWoIds, envWoIds, fiWoIds] = await Promise.all([
      executeDbOperation(async (db) =>
        db.selectDistinct({ workOrderId: woSOPExecution.workOrderId }).from(woSOPExecution)
      ),
      executeDbOperation(async (db) =>
        db.selectDistinct({ workOrderId: woCleaningLogs.workOrderId }).from(woCleaningLogs)
      ),
      executeDbOperation(async (db) =>
        db.selectDistinct({ workOrderId: woEnvironmentalLogs.workOrderId }).from(woEnvironmentalLogs)
      ),
      executeDbOperation(async (db) =>
        db.selectDistinct({ workOrderId: woFinishedInspection.workOrderId }).from(woFinishedInspection)
      ),
    ]);

    // Collect unique WO IDs
    const woIdSet = new Set<number>();
    for (const row of [...sopWoIds, ...cleanWoIds, ...envWoIds, ...fiWoIds]) {
      woIdSet.add(row.workOrderId);
    }
    const woIds = Array.from(woIdSet);

    if (woIds.length === 0) {
      // No execution data at all
      const emptyDashboard: BatchRecordsDashboard = {
        totalRecords: 0,
        pendingRecords: 0,
        inProgressRecords: 0,
        completedRecords: 0,
        deviationRecords: 0,
        completedToday: 0,
        avgCompletionTime: null,
        byStatus: { pending: 0, in_progress: 0, completed: 0, deviation: 0 },
        byOperation: [],
        topProducts: [],
        recentActivity: [],
        recentRecords: [],
      };
      return NextResponse.json({ success: true, data: emptyDashboard });
    }

    // Step 2: Get WO details for all relevant WOs
    const woDetails = await executeDbOperation(async (db) =>
      db
        .select({
          id: workOrders.id,
          woNumber: workOrders.woNumber,
          batchNumber: workOrders.batchNumber,
          status: workOrders.status,
          productId: workOrders.productId,
          productCode: items.code,
          productName: items.nameTh,
          plannedStartDate: workOrders.plannedStartDate,
          actualEndDate: workOrders.actualEndDate,
          actualStartDate: workOrders.actualStartDate,
          updatedAt: workOrders.updatedAt,
        })
        .from(workOrders)
        .leftJoin(items, eq(workOrders.productId, items.id))
        .where(inArray(workOrders.id, woIds))
    );

    // Step 3: Map WO statuses to eBMR statuses
    // planned/released → pending, in_progress → in_progress, completed/closed → completed
    const mapStatus = (woStatus: string): string => {
      if (woStatus === 'completed' || woStatus === 'closed') return 'completed';
      if (woStatus === 'in_progress') return 'in_progress';
      return 'pending'; // planned, released, draft
    };

    const byStatus: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, deviation: 0 };
    const productMap = new Map<number, { productId: number; productName: string; productCode: string; total: number; completed: number }>();

    for (const wo of woDetails) {
      const ebmrStatus = mapStatus(wo.status as string);
      byStatus[ebmrStatus] = (byStatus[ebmrStatus] || 0) + 1;

      const pid = wo.productId as number;
      if (pid) {
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            productId: pid,
            productName: (wo.productName as string) || 'Unknown',
            productCode: (wo.productCode as string) || 'N/A',
            total: 0,
            completed: 0,
          });
        }
        const p = productMap.get(pid)!;
        p.total++;
        if (ebmrStatus === 'completed') p.completed++;
      }
    }

    const totalRecords = woDetails.length;
    const pendingRecords = byStatus.pending;
    const inProgressRecords = byStatus.in_progress;
    const completedRecords = byStatus.completed;
    const deviationRecords = byStatus.deviation;

    // Completed today: WOs with completed status and actualEndDate = today
    const today = new Date().toISOString().split('T')[0];
    const completedToday = woDetails.filter((wo: Record<string, unknown>) => {
      const ebmrStatus = mapStatus(wo.status as string);
      if (ebmrStatus !== 'completed') return false;
      const endDate = wo.actualEndDate ? new Date(wo.actualEndDate as string).toISOString().split('T')[0] : null;
      const updatedDate = wo.updatedAt ? new Date(wo.updatedAt as string).toISOString().split('T')[0] : null;
      return endDate === today || updatedDate === today;
    }).length;

    // Average production time (in HOURS) across completed WOs that recorded both
    // a real start and end. eBMR durations differ per WO, so this is a genuine
    // average — not a placeholder. Skips rows missing either timestamp or with a
    // non-positive span (bad data) rather than skewing the mean. (list item 48)
    let avgCompletionTime: number | null = null;
    {
      const durationsHours: number[] = [];
      for (const wo of woDetails) {
        if (mapStatus(wo.status as string) !== 'completed') continue;
        const startRaw = wo.actualStartDate as string | Date | null;
        const endRaw = wo.actualEndDate as string | Date | null;
        if (!startRaw || !endRaw) continue;
        const start = new Date(startRaw).getTime();
        const end = new Date(endRaw).getTime();
        if (isNaN(start) || isNaN(end)) continue;
        const hours = (end - start) / (1000 * 60 * 60);
        if (hours > 0) durationsHours.push(hours);
      }
      if (durationsHours.length > 0) {
        const sum = durationsHours.reduce((s, h) => s + h, 0);
        // One decimal place of hours; the UI formats hours→days/hours for display.
        avgCompletionTime = Math.round((sum / durationsHours.length) * 10) / 10;
      }
    }

    // Step 4: Get execution activity counts per WO for progress tracking
    const [sopCounts, cleanCounts, envCounts, fiCounts] = await Promise.all([
      executeDbOperation(async (db) =>
        db.select({ workOrderId: woSOPExecution.workOrderId, count: count() })
          .from(woSOPExecution)
          .where(inArray(woSOPExecution.workOrderId, woIds))
          .groupBy(woSOPExecution.workOrderId)
      ),
      executeDbOperation(async (db) =>
        db.select({ workOrderId: woCleaningLogs.workOrderId, count: count() })
          .from(woCleaningLogs)
          .where(inArray(woCleaningLogs.workOrderId, woIds))
          .groupBy(woCleaningLogs.workOrderId)
      ),
      executeDbOperation(async (db) =>
        db.select({ workOrderId: woEnvironmentalLogs.workOrderId, count: count() })
          .from(woEnvironmentalLogs)
          .where(inArray(woEnvironmentalLogs.workOrderId, woIds))
          .groupBy(woEnvironmentalLogs.workOrderId)
      ),
      executeDbOperation(async (db) =>
        db.select({ workOrderId: woFinishedInspection.workOrderId, count: count() })
          .from(woFinishedInspection)
          .where(inArray(woFinishedInspection.workOrderId, woIds))
          .groupBy(woFinishedInspection.workOrderId)
      ),
    ]);

    // Build execution summary per category (as "operations")
    const byOperation = [
      { operationId: 1, operationName: 'SOP Execution', recordCount: sopCounts.reduce((s: number, r: { count: number }) => s + r.count, 0), completedCount: sopCounts.length },
      { operationId: 2, operationName: 'Cleaning Verification', recordCount: cleanCounts.reduce((s: number, r: { count: number }) => s + r.count, 0), completedCount: cleanCounts.length },
      { operationId: 3, operationName: 'Environmental Monitoring', recordCount: envCounts.reduce((s: number, r: { count: number }) => s + r.count, 0), completedCount: envCounts.length },
      { operationId: 4, operationName: 'Finished Inspection', recordCount: fiCounts.reduce((s: number, r: { count: number }) => s + r.count, 0), completedCount: fiCounts.length },
    ].filter((op) => op.recordCount > 0);

    // Top products
    const topProducts = Array.from(productMap.values())
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productCode: p.productCode,
        recordCount: p.total,
        completionRate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
      }))
      .sort((a, b) => b.recordCount - a.recordCount)
      .slice(0, 6);

    // Recent activity (last 7 days) — count SOP executions created per day
    const recentActivity: Array<{ date: string; completed: number; deviations: number }> = [];
    const nowDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(nowDate);
      date.setDate(date.getDate() - i);
      const dayLabel = date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });
      // Count WOs that completed on this date
      const dateStr = date.toISOString().split('T')[0];
      const completedOnDay = woDetails.filter((wo: Record<string, unknown>) => {
        if (mapStatus(wo.status as string) !== 'completed') return false;
        const endDate = wo.actualEndDate ? new Date(wo.actualEndDate as string).toISOString().split('T')[0] : null;
        return endDate === dateStr;
      }).length;
      recentActivity.push({ date: dayLabel, completed: completedOnDay, deviations: 0 });
    }

    // Recent records — latest WOs with execution data
    const recentRecords = [...woDetails]
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.id as number) - (a.id as number))
      .slice(0, 8)
      .map((wo: Record<string, unknown>) => ({
        id: wo.id as number,
        woNumber: (wo.woNumber as string) || '',
        batchNumber: (wo.batchNumber as string) || '',
        productName: (wo.productName as string) || 'Unknown',
        stepName: `eBMR - ${(wo.batchNumber as string) || 'N/A'}`,
        status: mapStatus(wo.status as string),
        startTime: (wo.actualStartDate as string) || (wo.plannedStartDate as string) || null,
      }));

    const dashboard: BatchRecordsDashboard = {
      totalRecords,
      pendingRecords,
      inProgressRecords,
      completedRecords,
      deviationRecords,
      completedToday,
      // Average production time in hours across completed WOs (list item 48).
      // null only when no completed WO has both start+end timestamps.
      avgCompletionTime,
      byStatus,
      byOperation,
      topProducts,
      recentActivity,
      recentRecords,
    };

    return NextResponse.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Error fetching batch records dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

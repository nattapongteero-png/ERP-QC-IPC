/**
 * Stability Dashboard API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/dashboard - Get comprehensive stability dashboard data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  sqliteStabilityStudies,
  sqliteStabilitySamples,
  sqliteStabilityProtocols,
  sqliteItems,
} from '@/lib/db/schema';
import { eq, and, count, lte, gte } from 'drizzle-orm';

export interface StabilityDashboard {
  totalActiveStudies: number;
  totalCompletedStudies: number;
  totalOnHoldStudies: number;
  overdueSamples: number;
  upcomingSamples: number;
  oosThisMonth: number;
  completedThisMonth: number;
  byStatus: Record<string, number>;
  byStudyType: Record<string, number>;
  byProduct: Array<{
    productId: number;
    productName: string;
    activeStudies: number;
    completedStudies: number;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
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
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Get study counts by status
    const statusResult = await database
      .select({
        status: sqliteStabilityStudies.status,
        count: count(),
      })
      .from(sqliteStabilityStudies)
      .groupBy(sqliteStabilityStudies.status);

    const byStatus: Record<string, number> = {
      active: 0,
      completed: 0,
      on_hold: 0,
      cancelled: 0,
    };
    let totalActiveStudies = 0;
    let totalCompletedStudies = 0;
    let totalOnHoldStudies = 0;

    for (const row of statusResult) {
      byStatus[row.status] = row.count;
      if (row.status === 'active') totalActiveStudies = row.count;
      if (row.status === 'completed') totalCompletedStudies = row.count;
      if (row.status === 'on_hold') totalOnHoldStudies = row.count;
    }

    // Get study counts by type
    const typeResult = await database
      .select({
        studyType: sqliteStabilityProtocols.studyType,
        count: count(),
      })
      .from(sqliteStabilityStudies)
      .leftJoin(
        sqliteStabilityProtocols,
        eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
      )
      .where(eq(sqliteStabilityStudies.status, 'active'))
      .groupBy(sqliteStabilityProtocols.studyType);

    const byStudyType: Record<string, number> = {
      long_term: 0,
      accelerated: 0,
      intermediate: 0,
    };
    for (const row of typeResult) {
      if (row.studyType) {
        byStudyType[row.studyType] = row.count;
      }
    }

    // Get overdue samples count
    const overdueResult = await database
      .select({ count: count() })
      .from(sqliteStabilitySamples)
      .innerJoin(
        sqliteStabilityStudies,
        eq(sqliteStabilitySamples.studyId, sqliteStabilityStudies.id)
      )
      .where(
        and(
          eq(sqliteStabilitySamples.status, 'pending'),
          lte(sqliteStabilitySamples.scheduledDate, todayStr),
          eq(sqliteStabilityStudies.status, 'active')
        )
      );
    const overdueSamples = overdueResult[0]?.count || 0;

    // Get upcoming samples (next 30 days)
    const upcomingResult = await database
      .select({ count: count() })
      .from(sqliteStabilitySamples)
      .innerJoin(
        sqliteStabilityStudies,
        eq(sqliteStabilitySamples.studyId, sqliteStabilityStudies.id)
      )
      .where(
        and(
          eq(sqliteStabilitySamples.status, 'pending'),
          gte(sqliteStabilitySamples.scheduledDate, todayStr),
          lte(sqliteStabilitySamples.scheduledDate, thirtyDaysLaterStr),
          eq(sqliteStabilityStudies.status, 'active')
        )
      );
    const upcomingSamples = upcomingResult[0]?.count || 0;

    // Get OOS this month
    const oosResult = await database
      .select({ count: count() })
      .from(sqliteStabilitySamples)
      .where(
        and(
          eq(sqliteStabilitySamples.oosDetected, true),
          gte(sqliteStabilitySamples.actualDate, monthStartStr)
        )
      );
    const oosThisMonth = oosResult[0]?.count || 0;

    // Get samples completed this month
    const completedSamplesResult = await database
      .select({ count: count() })
      .from(sqliteStabilitySamples)
      .where(
        and(
          eq(sqliteStabilitySamples.status, 'tested'),
          gte(sqliteStabilitySamples.actualDate, monthStartStr)
        )
      );
    const completedThisMonth = completedSamplesResult[0]?.count || 0;

    // Get studies by product
    const productResult = await database
      .select({
        productId: sqliteStabilityProtocols.productId,
        productName: sqliteItems.nameTh,
        status: sqliteStabilityStudies.status,
        count: count(),
      })
      .from(sqliteStabilityStudies)
      .leftJoin(
        sqliteStabilityProtocols,
        eq(sqliteStabilityStudies.protocolId, sqliteStabilityProtocols.id)
      )
      .leftJoin(sqliteItems, eq(sqliteStabilityProtocols.productId, sqliteItems.id))
      .groupBy(sqliteStabilityProtocols.productId, sqliteStabilityStudies.status);

    const productMap = new Map<
      number,
      { productId: number; productName: string; activeStudies: number; completedStudies: number }
    >();

    for (const row of productResult) {
      if (!row.productId) continue;
      if (!productMap.has(row.productId)) {
        productMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName || 'Unknown',
          activeStudies: 0,
          completedStudies: 0,
        });
      }
      const product = productMap.get(row.productId)!;
      if (row.status === 'active') {
        product.activeStudies = row.count;
      } else if (row.status === 'completed') {
        product.completedStudies = row.count;
      }
    }

    const byProduct = Array.from(productMap.values())
      .sort((a, b) => (b.activeStudies + b.completedStudies) - (a.activeStudies + a.completedStudies))
      .slice(0, 10);

    // Get recent activity (last 6 months)
    const recentActivity: Array<{ date: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      const monthLabel = monthDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      const monthResult = await database
        .select({ count: count() })
        .from(sqliteStabilitySamples)
        .where(
          and(
            eq(sqliteStabilitySamples.status, 'tested'),
            gte(sqliteStabilitySamples.actualDate, monthDate.toISOString().split('T')[0]),
            lte(sqliteStabilitySamples.actualDate, monthEnd.toISOString().split('T')[0])
          )
        );

      recentActivity.push({
        date: monthLabel,
        count: monthResult[0]?.count || 0,
      });
    }

    const dashboard: StabilityDashboard = {
      totalActiveStudies,
      totalCompletedStudies,
      totalOnHoldStudies,
      overdueSamples,
      upcomingSamples,
      oosThisMonth,
      completedThisMonth,
      byStatus,
      byStudyType,
      byProduct,
      recentActivity,
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching stability dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

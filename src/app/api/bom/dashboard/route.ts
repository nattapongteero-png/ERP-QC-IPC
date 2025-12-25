/**
 * BOM Dashboard API
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * GET /api/bom/dashboard - Get comprehensive BOM dashboard data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sqliteBOM, sqliteBOMLines, sqliteItems, sqliteWorkOrders } from '@/lib/db/schema';
import { eq, count, sql, inArray } from 'drizzle-orm';

export interface BOMDashboard {
  totalBOMs: number;
  activeBOMs: number;
  draftBOMs: number;
  obsoleteBOMs: number;
  totalMaterials: number;
  avgMaterialsPerBOM: number;
  activeWorkOrders: number;
  byStatus: Record<string, number>;
  topProducts: Array<{
    productId: number;
    productName: string;
    productCode: string;
    bomCount: number;
    activeBOMs: number;
  }>;
  recentBOMs: Array<{
    id: number;
    code: string;
    name: string;
    productName: string;
    status: string;
    version: string;
    createdAt: string;
    materialCount: number;
  }>;
  bomUtilization: Array<{
    bomId: number;
    bomCode: string;
    bomName: string;
    workOrderCount: number;
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

    // Get BOM counts by status
    const statusResult = await database
      .select({
        status: sqliteBOM.status,
        count: count(),
      })
      .from(sqliteBOM)
      .groupBy(sqliteBOM.status);

    const byStatus: Record<string, number> = {
      draft: 0,
      active: 0,
      approved: 0,
      obsolete: 0,
    };
    let totalBOMs = 0;
    let activeBOMs = 0;
    let draftBOMs = 0;
    let obsoleteBOMs = 0;

    for (const row of statusResult) {
      byStatus[row.status] = row.count;
      totalBOMs += row.count;
      if (row.status === 'active' || row.status === 'approved') activeBOMs += row.count;
      if (row.status === 'draft') draftBOMs = row.count;
      if (row.status === 'obsolete') obsoleteBOMs = row.count;
    }

    // Get total materials count (unique items used in BOMs)
    const materialsResult = await database
      .select({ count: sql`COUNT(DISTINCT ${sqliteBOMLines.itemId})` })
      .from(sqliteBOMLines);
    const totalMaterials = Number(materialsResult[0]?.count || 0);

    // Get average materials per BOM
    const avgResult = await database
      .select({
        avg: sql`ROUND(CAST(COUNT(*) AS FLOAT) / NULLIF(COUNT(DISTINCT ${sqliteBOMLines.bomId}), 0), 1)`
      })
      .from(sqliteBOMLines);
    const avgMaterialsPerBOM = Number(avgResult[0]?.avg || 0);

    // Get active work orders count
    const woResult = await database
      .select({ count: count() })
      .from(sqliteWorkOrders)
      .where(inArray(sqliteWorkOrders.status, ['planned', 'released', 'in_progress']));
    const activeWorkOrders = woResult[0]?.count || 0;

    // Get top products by BOM count
    const productResult = await database
      .select({
        productId: sqliteBOM.productId,
        productName: sqliteItems.nameTh,
        productCode: sqliteItems.code,
        status: sqliteBOM.status,
        count: count(),
      })
      .from(sqliteBOM)
      .leftJoin(sqliteItems, eq(sqliteBOM.productId, sqliteItems.id))
      .groupBy(sqliteBOM.productId, sqliteBOM.status);

    const productMap = new Map<
      number,
      { productId: number; productName: string; productCode: string; bomCount: number; activeBOMs: number }
    >();

    for (const row of productResult) {
      if (!row.productId) continue;
      if (!productMap.has(row.productId)) {
        productMap.set(row.productId, {
          productId: row.productId,
          productName: row.productName || 'Unknown',
          productCode: row.productCode || 'N/A',
          bomCount: 0,
          activeBOMs: 0,
        });
      }
      const product = productMap.get(row.productId)!;
      product.bomCount += row.count;
      if (row.status === 'active' || row.status === 'approved') {
        product.activeBOMs += row.count;
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.bomCount - a.bomCount)
      .slice(0, 8);

    // Get recent BOMs with material count
    const recentBOMsResult = await database
      .select({
        id: sqliteBOM.id,
        code: sqliteBOM.code,
        name: sqliteBOM.name,
        productName: sqliteItems.nameTh,
        status: sqliteBOM.status,
        version: sqliteBOM.version,
        createdAt: sqliteBOM.createdAt,
      })
      .from(sqliteBOM)
      .leftJoin(sqliteItems, eq(sqliteBOM.productId, sqliteItems.id))
      .orderBy(sql`${sqliteBOM.createdAt} DESC`)
      .limit(10);

    // Get material counts for recent BOMs
    const bomIds = recentBOMsResult.map((b: { id: number }) => b.id);
    let materialCounts: Record<number, number> = {};

    if (bomIds.length > 0) {
      const countResult = await database
        .select({
          bomId: sqliteBOMLines.bomId,
          count: count(),
        })
        .from(sqliteBOMLines)
        .where(inArray(sqliteBOMLines.bomId, bomIds))
        .groupBy(sqliteBOMLines.bomId);

      materialCounts = countResult.reduce((acc: Record<number, number>, row: { bomId: number; count: number }) => {
        acc[row.bomId] = row.count;
        return acc;
      }, {} as Record<number, number>);
    }

    const recentBOMs = recentBOMsResult.map((bom: {
      id: number;
      code: string;
      name: string;
      productName: string;
      status: string;
      version: string;
      createdAt: string;
    }) => ({
      ...bom,
      materialCount: materialCounts[bom.id] || 0,
    }));

    // Get BOM utilization (work order counts)
    const utilizationResult = await database
      .select({
        bomId: sqliteWorkOrders.bomId,
        bomCode: sqliteBOM.code,
        bomName: sqliteBOM.name,
        count: count(),
      })
      .from(sqliteWorkOrders)
      .leftJoin(sqliteBOM, eq(sqliteWorkOrders.bomId, sqliteBOM.id))
      .where(eq(sqliteBOM.status, 'active'))
      .groupBy(sqliteWorkOrders.bomId)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(8);

    const bomUtilization = utilizationResult.map((row: {
      bomId: number;
      bomCode: string;
      bomName: string;
      count: number;
    }) => ({
      bomId: row.bomId,
      bomCode: row.bomCode || 'N/A',
      bomName: row.bomName || 'Unknown',
      workOrderCount: row.count,
    }));

    const dashboard: BOMDashboard = {
      totalBOMs,
      activeBOMs,
      draftBOMs,
      obsoleteBOMs,
      totalMaterials,
      avgMaterialsPerBOM,
      activeWorkOrders,
      byStatus,
      topProducts,
      recentBOMs,
      bomUtilization,
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching BOM dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}

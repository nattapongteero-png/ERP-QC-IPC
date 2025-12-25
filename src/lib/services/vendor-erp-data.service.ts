/**
 * Vendor ERP Data Service
 * Provides hospital data to external vendors filtered by their TPP and TTMT codes
 * Supports herbal medicine (TTMT) and pharmaceutical (TPP) products
 */

import { eq, and, sql, gte, lte, inArray, desc, or } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { toQueryDate, formatDateFromDb } from '@/lib/db/date-utils';
import type { VendorProductCodes } from './vendor-api-key.service';

// ============================================
// Types - All include both tppCode and ttmtCode
// ============================================

export interface PurchasePlanItem {
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  plannedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  actualQuantity: number;
  actualValue: number;
}

export interface PurchasePlan {
  id: number;
  hospitalCode: string;
  hospitalName: string;
  fiscalYear: number;
  quarter: number;
  name: string;
  budgetCeiling: number;
  actualSpend: number;
  status: string;
  startDate: string;
  endDate: string;
  items: PurchasePlanItem[];
}

export interface HospitalStockItem {
  hospitalCode: string;
  hospitalName: string;
  warehouseCode: string;
  warehouseName: string;
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string | null;
  lastMovementDate: string | null;
  daysUntilExpiry: number | null;
}

export interface ConsumptionItem {
  hospitalCode: string;
  hospitalName: string;
  warehouseCode: string;
  warehouseName: string;
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  date: string;
  quantity: number;
  value: number;
}

export interface ConsumptionSummary {
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  totalQuantity: number;
  totalValue: number;
  avgDailyQuantity: number;
  dataPoints: number;
}

export interface ConsumptionRateItem {
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  totalConsumption: number;
  avgDailyConsumption: number;
  avgDailyValue: number;
  minDailyConsumption: number;
  maxDailyConsumption: number;
  consumptionStdDev: number;
  dataPointsCount: number;
  periodStartDate: string;
  periodEndDate: string;
  currentHospitalStock: number;
  daysOfStockRemaining: number;
  forecastedDemand: number;
  forecastedDemandLow: number;
  forecastedDemandHigh: number;
  vendorStockAvailable: number;
  canFulfillForecast: boolean;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// Query Interfaces - All support tppCode AND ttmtCode filters
// ============================================

export interface PlansQuery {
  productCodes: VendorProductCodes;
  hospitalCode?: string;
  fiscalYear?: number;
  quarter?: number;
  status?: string;
  tppCode?: string;  // Filter by specific TPP code
  ttmtCode?: string; // Filter by specific TTMT code
  page?: number;
  pageSize?: number;
}

export interface HospitalStockQuery {
  productCodes: VendorProductCodes;
  hospitalCode?: string;
  warehouseCode?: string;
  includeExpiring?: boolean;
  expiringWithinDays?: number;
  tppCode?: string;
  ttmtCode?: string;
  page?: number;
  pageSize?: number;
}

export interface ConsumptionQuery {
  productCodes: VendorProductCodes;
  hospitalCode?: string;
  warehouseCode?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'daily' | 'weekly' | 'monthly';
  tppCode?: string;
  ttmtCode?: string;
  page?: number;
  pageSize?: number;
}

export interface ConsumptionRateQuery {
  productCodes: VendorProductCodes;
  hospitalCode?: string;
  periodDays?: number;
  forecastDays?: number;
  tppCode?: string;
  ttmtCode?: string;
}

// ============================================
// Helper: Build product code filter condition
// ============================================

function buildProductCodeFilter(
  itemsTable: any,
  productCodes: VendorProductCodes,
  specificTppCode?: string,
  specificTtmtCode?: string
) {
  // If specific codes provided, use those
  if (specificTppCode) {
    return eq(itemsTable.tppCode, specificTppCode);
  }
  if (specificTtmtCode) {
    return eq(itemsTable.ttmtCode, specificTtmtCode);
  }

  // Otherwise filter by vendor's product codes (TPP OR TTMT)
  const conditions = [];

  if (productCodes.tppCodes.length > 0) {
    conditions.push(inArray(itemsTable.tppCode, productCodes.tppCodes));
  }
  if (productCodes.ttmtCodes.length > 0) {
    conditions.push(inArray(itemsTable.ttmtCode, productCodes.ttmtCodes));
  }

  if (conditions.length === 0) {
    // No codes - this shouldn't happen as middleware checks
    return sql`1=0`; // Return no results
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return or(...conditions);
}

// ============================================
// Service Implementation
// ============================================

export class VendorErpDataService {
  /**
   * Get purchase plans filtered by vendor's TPP/TTMT codes
   * Note: This requires a purchase_plans table which may not exist yet
   * For now, returns empty results - actual implementation depends on schema
   */
  async getPlans(query: PlansQuery): Promise<PaginatedResult<PurchasePlan>> {
    const { page = 1, pageSize = 50 } = query;

    // TODO: Implement when purchase_plans table exists
    // For now, return empty result as purchase planning may not be implemented
    // Will use query.productCodes, query.tppCode, query.ttmtCode for filtering
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    };
  }

  /**
   * Get hospital stock levels filtered by vendor's TPP/TTMT codes
   */
  async getHospitalStock(query: HospitalStockQuery): Promise<PaginatedResult<HospitalStockItem>> {
    const {
      productCodes,
      warehouseCode,
      includeExpiring = false,
      expiringWithinDays = 90,
      tppCode,
      ttmtCode,
      page = 1,
      pageSize = 50
    } = query;

    const offset = (page - 1) * pageSize;

    return executeDbOperation(async (db) => {
      const itemsTable = getTableRef('items');
      const lotsTable = getTableRef('inventoryLots');
      const warehousesTable = getTableRef('warehouses');

      // Build WHERE conditions
      const productFilter = buildProductCodeFilter(itemsTable, productCodes, tppCode, ttmtCode);
      const conditions = [
        productFilter,
        eq(lotsTable.status, 'released'),
      ];

      if (warehouseCode) {
        conditions.push(eq(warehousesTable.code, warehouseCode));
      }

      if (includeExpiring) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + expiringWithinDays);
        conditions.push(lte(lotsTable.expiryDate, toQueryDate(futureDate.toISOString().split('T')[0])));
      }

      // Query stock by lot
      const results = await db
        .select({
          tppCode: itemsTable.tppCode,
          ttmtCode: itemsTable.ttmtCode,
          itemName: itemsTable.nameTh,
          warehouseCode: warehousesTable.code,
          warehouseName: warehousesTable.name,
          quantity: lotsTable.quantity,
          lotNumber: lotsTable.lotNumber,
          expiryDate: lotsTable.expiryDate,
          receivedDate: lotsTable.receivedDate,
        })
        .from(lotsTable)
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
        .where(and(...conditions))
        .orderBy(desc(lotsTable.expiryDate))
        .limit(pageSize)
        .offset(offset);

      const today = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: HospitalStockItem[] = results.map((r: any) => {
        const expiryDate = r.expiryDate ? formatDateFromDb(r.expiryDate) : null;
        let daysUntilExpiry: number | null = null;

        if (expiryDate) {
          const expiry = new Date(expiryDate);
          daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          hospitalCode: '10001', // Default hospital code
          hospitalName: 'โรงพยาบาลสมุนไพร', // Default hospital name
          warehouseCode: r.warehouseCode,
          warehouseName: r.warehouseName,
          tppCode: r.tppCode,
          ttmtCode: r.ttmtCode,
          itemName: r.itemName,
          quantity: Number(r.quantity),
          lotNumber: r.lotNumber,
          expiryDate,
          lastMovementDate: r.receivedDate ? formatDateFromDb(r.receivedDate) : null,
          daysUntilExpiry,
        };
      });

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(lotsTable)
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
        .where(and(...conditions));

      return {
        items,
        total: Number(countResult[0]?.count || 0),
        page,
        pageSize,
      };
    });
  }

  /**
   * Get consumption data filtered by vendor's TPP/TTMT codes
   */
  async getConsumption(query: ConsumptionQuery): Promise<{
    items: ConsumptionItem[];
    summary: ConsumptionSummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      productCodes,
      startDate,
      endDate,
      tppCode,
      ttmtCode,
      page = 1,
      pageSize = 50
    } = query;

    const offset = (page - 1) * pageSize;

    return executeDbOperation(async (db) => {
      const itemsTable = getTableRef('items');
      const transactionsTable = getTableRef('inventoryTransactions');
      const lotsTable = getTableRef('inventoryLots');
      const warehousesTable = getTableRef('warehouses');

      // Build WHERE conditions for issue transactions (consumption)
      const productFilter = buildProductCodeFilter(itemsTable, productCodes, tppCode, ttmtCode);
      const conditions = [
        productFilter,
        eq(transactionsTable.transactionType, 'issue'),
      ];

      if (startDate) {
        conditions.push(gte(transactionsTable.createdAt, toQueryDate(startDate)));
      }

      if (endDate) {
        conditions.push(lte(transactionsTable.createdAt, toQueryDate(endDate)));
      }

      // Query consumption transactions
      const results = await db
        .select({
          tppCode: itemsTable.tppCode,
          ttmtCode: itemsTable.ttmtCode,
          itemName: itemsTable.nameTh,
          warehouseCode: warehousesTable.code,
          warehouseName: warehousesTable.name,
          quantity: transactionsTable.quantity,
          createdAt: transactionsTable.createdAt,
        })
        .from(transactionsTable)
        .innerJoin(lotsTable, eq(transactionsTable.lotId, lotsTable.id))
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .innerJoin(warehousesTable, eq(lotsTable.warehouseId, warehousesTable.id))
        .where(and(...conditions))
        .orderBy(desc(transactionsTable.createdAt))
        .limit(pageSize)
        .offset(offset);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: ConsumptionItem[] = results.map((r: any) => ({
        hospitalCode: '10001',
        hospitalName: 'โรงพยาบาลสมุนไพร',
        warehouseCode: r.warehouseCode,
        warehouseName: r.warehouseName,
        tppCode: r.tppCode,
        ttmtCode: r.ttmtCode,
        itemName: r.itemName,
        date: formatDateFromDb(r.createdAt) || new Date().toISOString().split('T')[0],
        quantity: Math.abs(Number(r.quantity)),
        value: 0, // Would need price lookup
      }));

      // Build summary by product code (use TPP or TTMT as key)
      const summaryMap = new Map<string, ConsumptionSummary>();
      for (const item of items) {
        const key = item.tppCode || item.ttmtCode || 'unknown';
        const existing = summaryMap.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.totalValue += item.value;
          existing.dataPoints++;
        } else {
          summaryMap.set(key, {
            tppCode: item.tppCode,
            ttmtCode: item.ttmtCode,
            itemName: item.itemName,
            totalQuantity: item.quantity,
            totalValue: item.value,
            avgDailyQuantity: 0,
            dataPoints: 1,
          });
        }
      }

      // Calculate averages
      const summary = Array.from(summaryMap.values()).map(s => ({
        ...s,
        avgDailyQuantity: s.dataPoints > 0 ? Math.round(s.totalQuantity / s.dataPoints) : 0,
      }));

      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)` })
        .from(transactionsTable)
        .innerJoin(lotsTable, eq(transactionsTable.lotId, lotsTable.id))
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .where(and(...conditions));

      return {
        items,
        summary,
        total: Number(countResult[0]?.count || 0),
        page,
        pageSize,
      };
    });
  }

  /**
   * Get consumption rate analytics with demand forecasting
   */
  async getConsumptionRate(query: ConsumptionRateQuery): Promise<ConsumptionRateItem[]> {
    const {
      productCodes,
      periodDays = 30,
      forecastDays = 30,
      tppCode,
      ttmtCode,
    } = query;

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodEnd = new Date();

    return executeDbOperation(async (db) => {
      const itemsTable = getTableRef('items');
      const transactionsTable = getTableRef('inventoryTransactions');
      const lotsTable = getTableRef('inventoryLots');

      // Build product filter
      const productFilter = buildProductCodeFilter(itemsTable, productCodes, tppCode, ttmtCode);

      // Get consumption data for the period
      const consumptionData = await db
        .select({
          tppCode: itemsTable.tppCode,
          ttmtCode: itemsTable.ttmtCode,
          itemName: itemsTable.nameTh,
          quantity: transactionsTable.quantity,
          createdAt: transactionsTable.createdAt,
          onHand: itemsTable.onHand,
        })
        .from(transactionsTable)
        .innerJoin(lotsTable, eq(transactionsTable.lotId, lotsTable.id))
        .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
        .where(
          and(
            productFilter,
            eq(transactionsTable.transactionType, 'issue'),
            gte(transactionsTable.createdAt, toQueryDate(periodStart.toISOString().split('T')[0]))
          )
        );

      // Group by product code and calculate statistics
      const statsMap = new Map<string, {
        tppCode: string | null;
        ttmtCode: string | null;
        itemName: string;
        quantities: number[];
        onHand: number;
      }>();

      for (const row of consumptionData) {
        const key = row.tppCode || row.ttmtCode || 'unknown';
        const existing = statsMap.get(key);
        const qty = Math.abs(Number(row.quantity));

        if (existing) {
          existing.quantities.push(qty);
        } else {
          statsMap.set(key, {
            tppCode: row.tppCode,
            ttmtCode: row.ttmtCode,
            itemName: row.itemName,
            quantities: [qty],
            onHand: Number(row.onHand),
          });
        }
      }

      // Calculate analytics for each item
      const results: ConsumptionRateItem[] = [];

      for (const [, stats] of statsMap) {
        const { quantities, tppCode, ttmtCode, itemName, onHand } = stats;
        const n = quantities.length;

        if (n === 0) continue;

        const total = quantities.reduce((a, b) => a + b, 0);
        const avg = total / n;
        const min = Math.min(...quantities);
        const max = Math.max(...quantities);

        // Calculate standard deviation
        const variance = quantities.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        // Calculate daily average
        const avgDaily = total / periodDays;

        // Forecast
        const forecastedDemand = Math.round(avgDaily * forecastDays);
        const forecastedLow = Math.round((avgDaily - stdDev) * forecastDays);
        const forecastedHigh = Math.round((avgDaily + stdDev) * forecastDays);

        // Days of stock remaining
        const daysRemaining = avgDaily > 0 ? Math.round(onHand / avgDaily) : 999;

        // Trend analysis (simplified)
        let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        let trendPercentage = 0;

        if (quantities.length >= 2) {
          const firstHalf = quantities.slice(0, Math.floor(n / 2));
          const secondHalf = quantities.slice(Math.floor(n / 2));
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

          if (firstAvg > 0) {
            trendPercentage = ((secondAvg - firstAvg) / firstAvg) * 100;
            if (trendPercentage > 10) trend = 'increasing';
            else if (trendPercentage < -10) trend = 'decreasing';
          }
        }

        results.push({
          tppCode,
          ttmtCode,
          itemName,
          totalConsumption: total,
          avgDailyConsumption: Math.round(avgDaily * 100) / 100,
          avgDailyValue: 0, // Would need price data
          minDailyConsumption: min,
          maxDailyConsumption: max,
          consumptionStdDev: Math.round(stdDev * 100) / 100,
          dataPointsCount: n,
          periodStartDate: periodStart.toISOString().split('T')[0],
          periodEndDate: periodEnd.toISOString().split('T')[0],
          currentHospitalStock: onHand,
          daysOfStockRemaining: daysRemaining,
          forecastedDemand,
          forecastedDemandLow: Math.max(0, forecastedLow),
          forecastedDemandHigh: forecastedHigh,
          vendorStockAvailable: 0, // Would need vendor inventory lookup
          canFulfillForecast: true,
          trend,
          trendPercentage: Math.round(trendPercentage * 10) / 10,
        });
      }

      return results;
    });
  }
}

export const vendorErpDataService = new VendorErpDataService();

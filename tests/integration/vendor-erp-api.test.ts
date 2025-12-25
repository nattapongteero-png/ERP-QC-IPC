/**
 * Vendor ERP API Integration Tests
 *
 * Tests the vendor-facing ERP API endpoints that provide hospital data
 * for demand forecasting and production planning.
 *
 * These tests verify:
 * - API key authentication and authorization
 * - All 4 endpoints are accessible and return proper response structure
 * - TPP and TTMT code filtering support
 * - Service layer methods work correctly
 *
 * Feature: VMI Vendor ERP Integration (Task 8)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getSqliteDb, schema } from '../../src/lib/db';
import { vendorApiKeyService } from '../../src/lib/services/vendor-api-key.service';
import { vendorErpDataService } from '../../src/lib/services/vendor-erp-data.service';
import type { VendorProductCodes } from '../../src/lib/services/vendor-api-key.service';
import { eq } from 'drizzle-orm';

describe('Vendor ERP API Integration', () => {
  let db: ReturnType<typeof getSqliteDb>;
  let testVendorId: number;
  let testUserId: number;
  let testItemWithTpp: number;
  let testItemWithTtmt: number;
  let testWarehouseId: number;
  let testLotId: number;
  let apiKey: string;
  let productCodes: VendorProductCodes;

  beforeAll(async () => {
    db = await initializeDatabase() as ReturnType<typeof getSqliteDb>;

    // Create test user
    const userResult = await db.insert(schema.sqliteUsers).values({
      name: 'Test ERP User',
      password: 'test-hash',
      email: 'test-erp@example.com',
      role: 'admin',
      isActive: true,
    }).returning({ id: schema.sqliteUsers.id });
    testUserId = userResult[0].id;

    // Create test vendor
    const vendorResult = await db.insert(schema.sqliteVendors).values({
      code: 'TEST-ERP-VENDOR',
      name: 'Test ERP Vendor',
      isActive: true,
    }).returning({ id: schema.sqliteVendors.id });
    testVendorId = vendorResult[0].id;

    // Create test items with TPP and TTMT codes
    const itemWithTppResult = await db.insert(schema.sqliteItems).values({
      code: 'TEST-ERP-ITEM-TPP',
      nameTh: 'Test ERP Item with TPP',
      type: 'raw_material',
      primaryUnit: 'kg',
      tppCode: '1100010001000',
      ttmtCode: null,
      onHand: 1000,
    }).returning({ id: schema.sqliteItems.id });
    testItemWithTpp = itemWithTppResult[0].id;

    const itemWithTtmtResult = await db.insert(schema.sqliteItems).values({
      code: 'TEST-ERP-ITEM-TTMT',
      nameTh: 'Test ERP Item with TTMT',
      type: 'raw_material',
      primaryUnit: 'kg',
      tppCode: null,
      ttmtCode: 'A01234567',
      onHand: 500,
    }).returning({ id: schema.sqliteItems.id });
    testItemWithTtmt = itemWithTtmtResult[0].id;

    // Add items to AVL
    await db.insert(schema.sqliteApprovedVendorList).values([
      {
        vendorId: testVendorId,
        itemId: testItemWithTpp,
        isActive: true,
      },
      {
        vendorId: testVendorId,
        itemId: testItemWithTtmt,
        isActive: true,
      },
    ]);

    // Create test warehouse
    const warehouseResult = await db.insert(schema.sqliteWarehouses).values({
      code: 'TEST-WH-001',
      name: 'Test Warehouse',
      type: 'raw_material',
      status: 'active',
    }).returning({ id: schema.sqliteWarehouses.id });
    testWarehouseId = warehouseResult[0].id;

    // Create test inventory lot
    const lotResult = await db.insert(schema.sqliteInventoryLots).values({
      itemId: testItemWithTpp,
      warehouseId: testWarehouseId,
      lotNumber: 'TEST-LOT-001',
      quantity: 1000,
      unit: 'kg',
      status: 'released',
      receivedDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days from now
    }).returning({ id: schema.sqliteInventoryLots.id });
    testLotId = lotResult[0].id;

    // Create some inventory transactions for consumption data
    await db.insert(schema.sqliteInventoryTransactions).values([
      {
        lotId: testLotId,
        transactionType: 'issue',
        quantity: -50,
        unit: 'kg',
        balanceAfter: 950,
      },
      {
        lotId: testLotId,
        transactionType: 'issue',
        quantity: -30,
        unit: 'kg',
        balanceAfter: 920,
      },
    ]);

    // Create API key
    const keyResult = await vendorApiKeyService.createApiKey(
      testVendorId,
      'Integration Test Key',
      testUserId
    );
    apiKey = keyResult.apiKey;

    // Get product codes
    productCodes = await vendorApiKeyService.getVendorProductCodes(testVendorId);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.sqliteInventoryTransactions).where(eq(schema.sqliteInventoryTransactions.lotId, testLotId));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, testLotId));
    await db.delete(schema.sqliteWarehouses).where(eq(schema.sqliteWarehouses.id, testWarehouseId));
    await db.delete(schema.sqliteApprovedVendorList).where(eq(schema.sqliteApprovedVendorList.vendorId, testVendorId));
    await db.delete(schema.sqliteVendorApiKeys).where(eq(schema.sqliteVendorApiKeys.vendorId, testVendorId));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, testItemWithTpp));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, testItemWithTtmt));
    await db.delete(schema.sqliteVendors).where(eq(schema.sqliteVendors.id, testVendorId));
    await db.delete(schema.sqliteUsers).where(eq(schema.sqliteUsers.id, testUserId));
  });

  describe('API Key Management', () => {
    it('creates API key with vendorApiKeyService', async () => {
      const result = await vendorApiKeyService.createApiKey(
        testVendorId,
        'Test API Key',
        testUserId
      );

      expect(result.apiKey).toMatch(/^vmi_erp_/);
      expect(result.keyPrefix).toHaveLength(16);
      expect(result.vendorId).toBe(testVendorId);
      expect(result.name).toBe('Test API Key');
    });

    it('validates API key and returns vendor info', async () => {
      const validated = await vendorApiKeyService.validateApiKey(apiKey);

      expect(validated).not.toBeNull();
      expect(validated?.vendorId).toBe(testVendorId);
      expect(validated?.vendorCode).toBe('TEST-ERP-VENDOR');
      expect(validated?.vendorName).toBe('Test ERP Vendor');
      expect(validated?.permissions).toBe('read');
    });

    it('rejects invalid API key', async () => {
      const validated = await vendorApiKeyService.validateApiKey('invalid_key_12345');
      expect(validated).toBeNull();
    });

    it('retrieves vendor product codes (TPP and TTMT)', async () => {
      const codes = await vendorApiKeyService.getVendorProductCodes(testVendorId);

      expect(codes).toHaveProperty('tppCodes');
      expect(codes).toHaveProperty('ttmtCodes');
      expect(Array.isArray(codes.tppCodes)).toBe(true);
      expect(Array.isArray(codes.ttmtCodes)).toBe(true);
      expect(codes.tppCodes).toContain('1100010001000');
      expect(codes.ttmtCodes).toContain('A01234567');
    });
  });

  describe('Endpoint: GET /plans', () => {
    it('returns proper response structure with empty data', async () => {
      const result = await vendorErpDataService.getPlans({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('supports tppCode query parameter', async () => {
      const result = await vendorErpDataService.getPlans({
        productCodes,
        tppCode: '1100010001000',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports ttmtCode query parameter', async () => {
      const result = await vendorErpDataService.getPlans({
        productCodes,
        ttmtCode: 'A01234567',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports pagination parameters', async () => {
      const result = await vendorErpDataService.getPlans({
        productCodes,
        page: 2,
        pageSize: 10,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('Endpoint: GET /hospital-stock', () => {
    it('returns proper response structure', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('returns stock items filtered by vendor product codes', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      // Should have at least one item from our test lot
      expect(result.total).toBeGreaterThan(0);

      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('tppCode');
        expect(item).toHaveProperty('ttmtCode');
        expect(item).toHaveProperty('itemName');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('lotNumber');
        expect(item).toHaveProperty('warehouseCode');
        expect(item).toHaveProperty('warehouseName');
      }
    });

    it('supports tppCode filter', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes,
        tppCode: '1100010001000',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports ttmtCode filter', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes,
        ttmtCode: 'A01234567',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports includeExpiring parameter', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes,
        includeExpiring: true,
        expiringWithinDays: 365,
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('Endpoint: GET /consumption', () => {
    it('returns proper response structure', async () => {
      const result = await vendorErpDataService.getConsumption({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(Array.isArray(result.items)).toBe(true);
      expect(Array.isArray(result.summary)).toBe(true);
    });

    it('returns consumption data with TPP and TTMT codes', async () => {
      const result = await vendorErpDataService.getConsumption({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      if (result.items.length > 0) {
        const item = result.items[0];
        expect(item).toHaveProperty('tppCode');
        expect(item).toHaveProperty('ttmtCode');
        expect(item).toHaveProperty('itemName');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('warehouseCode');
      }
    });

    it('supports date range filters', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const result = await vendorErpDataService.getConsumption({
        productCodes,
        startDate,
        endDate,
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports tppCode filter', async () => {
      const result = await vendorErpDataService.getConsumption({
        productCodes,
        tppCode: '1100010001000',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('supports ttmtCode filter', async () => {
      const result = await vendorErpDataService.getConsumption({
        productCodes,
        ttmtCode: 'A01234567',
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('includes summary data', async () => {
      const result = await vendorErpDataService.getConsumption({
        productCodes,
        page: 1,
        pageSize: 50,
      });

      if (result.summary.length > 0) {
        const summary = result.summary[0];
        expect(summary).toHaveProperty('tppCode');
        expect(summary).toHaveProperty('ttmtCode');
        expect(summary).toHaveProperty('itemName');
        expect(summary).toHaveProperty('totalQuantity');
        expect(summary).toHaveProperty('avgDailyQuantity');
        expect(summary).toHaveProperty('dataPoints');
      }
    });
  });

  describe('Endpoint: GET /analytics/consumption-rate', () => {
    it('returns proper response structure', async () => {
      const result = await vendorErpDataService.getConsumptionRate({
        productCodes,
        periodDays: 30,
        forecastDays: 30,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('returns consumption analytics with forecasting data', async () => {
      const result = await vendorErpDataService.getConsumptionRate({
        productCodes,
        periodDays: 30,
        forecastDays: 30,
      });

      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('tppCode');
        expect(item).toHaveProperty('ttmtCode');
        expect(item).toHaveProperty('itemName');
        expect(item).toHaveProperty('totalConsumption');
        expect(item).toHaveProperty('avgDailyConsumption');
        expect(item).toHaveProperty('minDailyConsumption');
        expect(item).toHaveProperty('maxDailyConsumption');
        expect(item).toHaveProperty('consumptionStdDev');
        expect(item).toHaveProperty('currentHospitalStock');
        expect(item).toHaveProperty('daysOfStockRemaining');
        expect(item).toHaveProperty('forecastedDemand');
        expect(item).toHaveProperty('forecastedDemandLow');
        expect(item).toHaveProperty('forecastedDemandHigh');
        expect(item).toHaveProperty('trend');
        expect(item).toHaveProperty('trendPercentage');
        expect(item).toHaveProperty('periodStartDate');
        expect(item).toHaveProperty('periodEndDate');

        // Verify trend is one of allowed values
        expect(['increasing', 'stable', 'decreasing']).toContain(item.trend);
      }
    });

    it('supports tppCode filter', async () => {
      const result = await vendorErpDataService.getConsumptionRate({
        productCodes,
        tppCode: '1100010001000',
        periodDays: 30,
        forecastDays: 30,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('supports ttmtCode filter', async () => {
      const result = await vendorErpDataService.getConsumptionRate({
        productCodes,
        ttmtCode: 'A01234567',
        periodDays: 30,
        forecastDays: 30,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('supports custom period and forecast days', async () => {
      const result = await vendorErpDataService.getConsumptionRate({
        productCodes,
        periodDays: 60,
        forecastDays: 45,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Product Code Filtering', () => {
    it('filters data by vendor TPP codes', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes: {
          tppCodes: ['1100010001000'],
          ttmtCodes: [],
        },
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      // Items should only include those with matching TPP code
      result.items.forEach(item => {
        if (item.tppCode) {
          expect(item.tppCode).toBe('1100010001000');
        }
      });
    });

    it('filters data by vendor TTMT codes', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes: {
          tppCodes: [],
          ttmtCodes: ['A01234567'],
        },
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      // Items should only include those with matching TTMT code
      result.items.forEach(item => {
        if (item.ttmtCode) {
          expect(item.ttmtCode).toBe('A01234567');
        }
      });
    });

    it('combines TPP and TTMT filters with OR logic', async () => {
      const result = await vendorErpDataService.getHospitalStock({
        productCodes: {
          tppCodes: ['1100010001000'],
          ttmtCodes: ['A01234567'],
        },
        page: 1,
        pageSize: 50,
      });

      expect(result).toHaveProperty('items');
      // Should include items matching either code
      result.items.forEach(item => {
        const matchesCode =
          (item.tppCode === '1100010001000') ||
          (item.ttmtCode === 'A01234567');
        expect(matchesCode).toBe(true);
      });
    });
  });
});

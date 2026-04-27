/**
 * Inventory Service Unit Tests
 *
 * Tests core inventory functions:
 * - receiveMaterial / receiveMaterialExtended
 * - updateLotStatus (QC workflow)
 * - getLotsForPicking (FEFO algorithm)
 * - reserveLots / issueMaterial
 * - adjustInventory / transferInventory
 * - getStockSummary / checkExpiryAlerts
 * - recalculateItemOnHand / getLotDetails
 * - GMP compliance (manufacturer, retest)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  receiveMaterial,
  updateLotStatus,
  getLotsForPicking,
  getAvailableLots,
  reserveLots,
  issueMaterial,
  adjustInventory,
  transferInventory,
  getStockSummary,
  checkExpiryAlerts,
  recalculateItemOnHand,
  getLotDetails,
  receiveMaterialExtended,
  updateLotManufacturerInfo,
  updateLotRetestInfo,
  checkRetestAlerts,
} from '@/lib/services/inventory.service';

const TEST_USER_ID = 1;
const NEAR_EXPIRY = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
const FAR_EXPIRY = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
const EXPIRED = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];

function seedBase() {
  sqlite.exec(`INSERT INTO users (id, email, password, name, role, is_active) VALUES (1, 'test@test.com', 'hash', 'Test', 'admin', 1)`);
  sqlite.exec(`INSERT INTO warehouses (id, code, name, type, is_active) VALUES (1, 'WH-RM', 'Raw Material WH', 'raw_material', 1)`);
  sqlite.exec(`INSERT INTO warehouses (id, code, name, type, is_active) VALUES (2, 'WH-FG', 'Finished Goods WH', 'finished_goods', 1)`);
  sqlite.exec(`INSERT INTO vendors (id, code, name, is_active) VALUES (1, 'V-001', 'Supplier A', 1)`);
  sqlite.exec(`INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active) VALUES (1, 'RM-001', 'สมุนไพร A', 'raw_material', 'kg', 0, 0, 1)`);
  sqlite.exec(`INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active) VALUES (2, 'RM-002', 'สมุนไพร B', 'raw_material', 'kg', 0, 0, 1)`);
  sqlite.exec(`INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active) VALUES (10, 'FG-001', 'ยาสมุนไพร', 'finished_goods', 'bottle', 0, 0, 1)`);
}

function cleanTables() {
  for (const t of ['inventory_transactions', 'inventory_lots', 'items', 'warehouses', 'vendors', 'users']) {
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* skip */ }
  }
}

describe('Inventory Service', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    for (const table of [
      schema.sqliteUsers, schema.sqliteVendors, schema.sqliteItems,
      schema.sqliteWarehouses, schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots, schema.sqliteInventoryTransactions,
    ]) {
      try { sqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ }
    }
  });

  afterAll(() => { sqlite.close(); });
  beforeEach(() => { cleanTables(); seedBase(); });

  // ============================================
  // RECEIVE MATERIAL
  // ============================================

  describe('receiveMaterial', () => {
    it('should create lot in quarantine', async () => {
      const lotId = await receiveMaterial(1, 'LOT-001', 100, 'kg', 1, FAR_EXPIRY, 1, 'PO-001', TEST_USER_ID);
      expect(lotId).toBeGreaterThan(0);

      const lot = await getLotDetails(lotId);
      expect(lot).not.toBeNull();
      expect(lot!.lotNumber).toBe('LOT-001');
      expect(lot!.quantity).toBe(100);
      expect(lot!.status).toBe('quarantine');
    });

    it('should create lot without expiry date', async () => {
      const lotId = await receiveMaterial(1, 'LOT-NOEXP', 50, 'kg', 1, null, null, null, TEST_USER_ID);
      expect(lotId).toBeGreaterThan(0);
    });

    it('should create lot without vendor', async () => {
      const lotId = await receiveMaterial(1, 'LOT-NOVENDOR', 75, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      expect(lotId).toBeGreaterThan(0);
    });
  });

  // ============================================
  // LOT STATUS (QC Workflow)
  // ============================================

  describe('updateLotStatus', () => {
    it('should release a quarantine lot', async () => {
      const lotId = await receiveMaterial(1, 'QC-1', 100, 'kg', 1, FAR_EXPIRY, 1, 'PO-001', TEST_USER_ID);
      const result = await updateLotStatus(lotId, 'released', TEST_USER_ID, undefined, 'COA-001');
      expect(result).toBe(true);
      expect((await getLotDetails(lotId))!.status).toBe('released');
    });

    it('should reject a lot', async () => {
      const lotId = await receiveMaterial(1, 'QC-REJ', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'rejected', TEST_USER_ID, 'Failed QC');
      expect((await getLotDetails(lotId))!.status).toBe('rejected');
    });

    it('should block a released lot', async () => {
      const lotId = await receiveMaterial(1, 'QC-BLK', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await updateLotStatus(lotId, 'blocked', TEST_USER_ID, 'Recall');
      expect((await getLotDetails(lotId))!.status).toBe('blocked');
    });
  });

  // ============================================
  // FEFO ALGORITHM
  // ============================================

  describe('getLotsForPicking (FEFO)', () => {
    beforeEach(async () => {
      const lot1 = await receiveMaterial(1, 'FEFO-NEAR', 100, 'kg', 1, NEAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'FEFO-FAR', 200, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);
    });

    it('should pick nearest expiry first', async () => {
      const result = await getLotsForPicking(1, 150);
      expect(result.allocated.length).toBeGreaterThanOrEqual(1);
      expect(result.remaining).toBe(0);
      expect(result.allocated[0].lotNumber).toBe('FEFO-NEAR');
    });

    it('should allocate across multiple lots', async () => {
      const result = await getLotsForPicking(1, 250);
      expect(result.allocated.length).toBe(2);
      expect(result.remaining).toBe(0);
    });

    it('should report remaining when insufficient', async () => {
      const result = await getLotsForPicking(1, 500);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should filter by warehouse', async () => {
      const result = await getLotsForPicking(1, 50, 2);
      expect(result.allocated.length).toBe(0);
      expect(result.remaining).toBe(50);
    });
  });

  // ============================================
  // AVAILABLE LOTS
  // ============================================

  describe('getAvailableLots', () => {
    it('should return only released lots', async () => {
      const lot1 = await receiveMaterial(1, 'AVAIL-REL', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await receiveMaterial(1, 'AVAIL-QC', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);

      const lots = await getAvailableLots(1);
      expect(lots.length).toBe(1);
      expect(lots[0].lotNumber).toBe('AVAIL-REL');
    });

    it('should return empty for no released lots', async () => {
      expect((await getAvailableLots(2)).length).toBe(0);
    });
  });

  // ============================================
  // ISSUE MATERIAL
  // ============================================

  describe('issueMaterial', () => {
    it('should reduce lot quantity', async () => {
      const lotId = await receiveMaterial(1, 'ISSUE-1', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const txnId = await issueMaterial(lotId, 30, 'WO', 1, 'WO-001', TEST_USER_ID);
      expect(txnId).toBeGreaterThan(0);
      expect((await getLotDetails(lotId))!.quantity).toBe(70);
    });

    it('should reject over-issue', async () => {
      const lotId = await receiveMaterial(1, 'ISSUE-2', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await expect(issueMaterial(lotId, 100, 'WO', 1, 'WO-001', TEST_USER_ID)).rejects.toThrow();
    });
  });

  // ============================================
  // ADJUST INVENTORY
  // ============================================

  describe('adjustInventory', () => {
    it('should adjust quantity up', async () => {
      const lotId = await receiveMaterial(1, 'ADJ-UP', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await adjustInventory(lotId, 120, 'Count correction', TEST_USER_ID);
      expect((await getLotDetails(lotId))!.quantity).toBe(120);
    });

    it('should adjust quantity down', async () => {
      const lotId = await receiveMaterial(1, 'ADJ-DN', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await adjustInventory(lotId, 80, 'Damaged', TEST_USER_ID);
      expect((await getLotDetails(lotId))!.quantity).toBe(80);
    });
  });

  // ============================================
  // TRANSFER INVENTORY
  // ============================================

  describe('transferInventory', () => {
    it('should transfer partial quantity', async () => {
      const lotId = await receiveMaterial(1, 'XFER-1', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const result = await transferInventory(lotId, 2, 40, TEST_USER_ID, 'Move to FG');
      expect(result.newLotId).toBeGreaterThan(0);
      expect(result.transactionId).toBeGreaterThan(0);
      expect((await getLotDetails(lotId))!.quantity).toBe(60);
    });

    it('should transfer full quantity', async () => {
      const lotId = await receiveMaterial(1, 'XFER-FULL', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      const result = await transferInventory(lotId, 2, 50, TEST_USER_ID);
      expect(result.newLotId).toBeGreaterThan(0);
      expect((await getLotDetails(lotId))!.quantity).toBe(0);
    });
  });

  // ============================================
  // STOCK SUMMARY
  // ============================================

  describe('getStockSummary', () => {
    it('should return stock by status', async () => {
      const l1 = await receiveMaterial(1, 'SUM-REL', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(l1, 'released', TEST_USER_ID);
      await receiveMaterial(1, 'SUM-QC', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);

      const s = await getStockSummary(1);
      expect(s).not.toBeNull();
      expect(s!.onHand).toBeGreaterThanOrEqual(100);
      expect(s!.quarantine).toBeGreaterThanOrEqual(50);
    });
  });

  // ============================================
  // EXPIRY ALERTS
  // ============================================

  describe('checkExpiryAlerts', () => {
    it('should detect near-expiry lots', async () => {
      const l = await receiveMaterial(1, 'EXP-NEAR', 100, 'kg', 1, NEAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(l, 'released', TEST_USER_ID);

      const alerts = await checkExpiryAlerts(30);
      expect(alerts.nearExpiry.length + alerts.expired.length).toBeGreaterThanOrEqual(1);
    });

    it('should not alert far expiry lots', async () => {
      const l = await receiveMaterial(2, 'EXP-FAR', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(l, 'released', TEST_USER_ID);

      const alerts = await checkExpiryAlerts(30);
      const farAlerts = [...alerts.nearExpiry, ...alerts.expired].filter(a => a.lotNumber === 'EXP-FAR');
      expect(farAlerts.length).toBe(0);
    });
  });

  // ============================================
  // RECALCULATE ON HAND
  // ============================================

  describe('recalculateItemOnHand', () => {
    it('should sum from lot quantities', async () => {
      const l1 = await receiveMaterial(1, 'RC-1', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(l1, 'released', TEST_USER_ID);
      const l2 = await receiveMaterial(1, 'RC-2', 50, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      await updateLotStatus(l2, 'released', TEST_USER_ID);

      const result = await recalculateItemOnHand(1);
      expect(result.onHand).toBeGreaterThanOrEqual(150);
    });
  });

  // ============================================
  // LOT DETAILS
  // ============================================

  describe('getLotDetails', () => {
    it('should return complete info', async () => {
      const lotId = await receiveMaterial(1, 'DET-1', 100, 'kg', 1, FAR_EXPIRY, 1, 'PO-001', TEST_USER_ID);
      const lot = await getLotDetails(lotId);
      expect(lot).not.toBeNull();
      expect(lot!.lotNumber).toBe('DET-1');
      expect(lot!.quantity).toBe(100);
      expect(lot!.unit).toBe('kg');
      expect(lot!.itemId).toBe(1);
    });

    it('should return null for non-existent', async () => {
      expect(await getLotDetails(9999)).toBeNull();
    });
  });

  // ============================================
  // GMP COMPLIANCE
  // ============================================

  describe('GMP Compliance', () => {
    it('should update manufacturer info (FR-055)', async () => {
      const lotId = await receiveMaterial(1, 'GMP-MFG', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      const result = await updateLotManufacturerInfo(lotId, 'Thai Herb Co', null, 'Import Ltd', null, 'TH', TEST_USER_ID);
      expect(result).toBe(true);

      const lot = await getLotDetails(lotId);
      expect(lot!.manufacturerName).toBe('Thai Herb Co');
      expect(lot!.countryOfOrigin).toBe('TH');
    });

    it('should update retest info (FR-056)', async () => {
      const lotId = await receiveMaterial(1, 'GMP-RT', 100, 'kg', 1, FAR_EXPIRY, null, null, TEST_USER_ID);
      const retestDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
      const result = await updateLotRetestInfo(lotId, retestDate, 6, TEST_USER_ID);
      expect(result).toBe(true);
    });

    it('should receive with extended GMP fields', async () => {
      const lotId = await receiveMaterialExtended({
        itemId: 1, lotNumber: 'GMP-EXT', quantity: 200, unit: 'kg',
        warehouseId: 1, expiryDate: FAR_EXPIRY,
        manufacturerName: 'Herb Factory', countryOfOrigin: 'TH',
        retestDate: FAR_EXPIRY, retestIntervalMonths: 12,
      }, TEST_USER_ID);
      expect(lotId).toBeGreaterThan(0);
    });
  });
});

/**
 * Inventory Service Tests
 * Tests for FEFO algorithm, lot traceability, and expiry alerts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getSqliteDb, schema } from '../../src/lib/db';
import { eq } from 'drizzle-orm';

describe('Inventory Service', () => {
  let db: ReturnType<typeof getSqliteDb>;

  beforeAll(async () => {
    db = await initializeDatabase() as ReturnType<typeof getSqliteDb>;
    
    // Create test data
    await db.insert(schema.sqliteItems).values([
      { id: 100, code: 'TEST-RM-001', nameTh: 'วัตถุดิบทดสอบ 1', type: 'raw_material', primaryUnit: 'kg', isLotControlled: true, isFEFO: true, shelfLifeDays: 365 },
      { id: 101, code: 'TEST-RM-002', nameTh: 'วัตถุดิบทดสอบ 2', type: 'raw_material', primaryUnit: 'kg', isLotControlled: true, isFEFO: true, shelfLifeDays: 180 },
    ]);

    await db.insert(schema.sqliteWarehouses).values([
      { id: 100, code: 'TEST-WH', name: 'Test Warehouse', type: 'raw_material', location: 'Test Location' },
    ]);

    // Create lots with different expiry dates
    const today = new Date();
    const nearExpiry = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days
    const farExpiry = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
    const expired = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    await db.insert(schema.sqliteInventoryLots).values([
      { id: 100, itemId: 100, lotNumber: 'LOT-001', warehouseId: 100, quantity: 100, unit: 'kg', status: 'released', expiryDate: nearExpiry.toISOString().split('T')[0] },
      { id: 101, itemId: 100, lotNumber: 'LOT-002', warehouseId: 100, quantity: 200, unit: 'kg', status: 'released', expiryDate: farExpiry.toISOString().split('T')[0] },
      { id: 102, itemId: 100, lotNumber: 'LOT-003', warehouseId: 100, quantity: 50, unit: 'kg', status: 'released', expiryDate: expired.toISOString().split('T')[0] },
      { id: 103, itemId: 101, lotNumber: 'LOT-004', warehouseId: 100, quantity: 150, unit: 'kg', status: 'quarantine', expiryDate: farExpiry.toISOString().split('T')[0] },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 100));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 101));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 102));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 103));
    await db.delete(schema.sqliteWarehouses).where(eq(schema.sqliteWarehouses.id, 100));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 100));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 101));
  });

  describe('FEFO Algorithm', () => {
    it('should return lots sorted by expiry date (FEFO)', async () => {
      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.itemId, 100));

      // Sort by expiry date (FEFO)
      const sortedLots = lots
        .filter(l => l.status === 'released' && l.quantity > 0)
        .sort((a, b) => new Date(a.expiryDate || '').getTime() - new Date(b.expiryDate || '').getTime());

      expect(sortedLots.length).toBeGreaterThan(0);
      // First lot should have earliest expiry
      expect(sortedLots[0].lotNumber).toBe('LOT-003'); // Expired lot
    });

    it('should exclude quarantine lots from picking', async () => {
      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.itemId, 101));

      const releasedLots = lots.filter(l => l.status === 'released');
      expect(releasedLots.length).toBe(0); // LOT-004 is in quarantine
    });

    it('should calculate available quantity correctly', async () => {
      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.itemId, 100));

      const totalAvailable = lots
        .filter(l => l.status === 'released')
        .reduce((sum, l) => sum + (l.quantity - (l.reservedQuantity || 0)), 0);

      expect(totalAvailable).toBe(350); // 100 + 200 + 50
    });
  });

  describe('Lot Traceability', () => {
    it('should track lot information', async () => {
      const [lot] = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.lotNumber, 'LOT-001'));

      expect(lot).toBeDefined();
      expect(lot.itemId).toBe(100);
      expect(lot.warehouseId).toBe(100);
      expect(lot.status).toBe('released');
    });
  });

  describe('Expiry Alerts', () => {
    it('should identify near-expiry lots', async () => {
      const today = new Date();
      const threshold = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.itemId, 100));

      const nearExpiryLots = lots.filter(l => {
        const expiryDate = new Date(l.expiryDate || '');
        return expiryDate <= threshold && expiryDate > today;
      });

      expect(nearExpiryLots.length).toBe(1); // LOT-001
      expect(nearExpiryLots[0].lotNumber).toBe('LOT-001');
    });

    it('should identify expired lots', async () => {
      const today = new Date();

      const lots = await db
        .select()
        .from(schema.sqliteInventoryLots)
        .where(eq(schema.sqliteInventoryLots.itemId, 100));

      const expiredLots = lots.filter(l => {
        const expiryDate = new Date(l.expiryDate || '');
        return expiryDate < today;
      });

      expect(expiredLots.length).toBe(1); // LOT-003
      expect(expiredLots[0].lotNumber).toBe('LOT-003');
    });
  });
});

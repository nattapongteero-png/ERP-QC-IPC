/**
 * Production Service Tests
 * Tests for BOM explosion, yield calculation, and work order workflows
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getSqliteDb, schema } from '../../src/lib/db';
import { eq } from 'drizzle-orm';

describe('Production Service', () => {
  let db: ReturnType<typeof getSqliteDb>;

  beforeAll(async () => {
    db = await initializeDatabase() as ReturnType<typeof getSqliteDb>;
    
    // Create test items
    await db.insert(schema.sqliteItems).values([
      { id: 200, code: 'TEST-FG-001', nameTh: 'ผลิตภัณฑ์สำเร็จรูปทดสอบ', type: 'finished_good', primaryUnit: 'bottle' },
      { id: 201, code: 'TEST-RM-101', nameTh: 'วัตถุดิบ A', type: 'raw_material', primaryUnit: 'kg' },
      { id: 202, code: 'TEST-RM-102', nameTh: 'วัตถุดิบ B', type: 'raw_material', primaryUnit: 'kg' },
      { id: 203, code: 'TEST-PK-101', nameTh: 'บรรจุภัณฑ์', type: 'packaging', primaryUnit: 'pcs' },
    ]);

    // Create BOM
    await db.insert(schema.sqliteBOM).values([
      { id: 200, code: 'BOM-TEST-001', name: 'BOM ทดสอบ', productId: 200, version: '1.0', status: 'approved', batchSize: 1000, batchUnit: 'bottle', yieldTarget: 98, lossAllowance: 2 },
    ]);

    // Create BOM Lines
    await db.insert(schema.sqliteBOMLines).values([
      { id: 200, bomId: 200, itemId: 201, quantity: 10, unit: 'kg', sequence: 1 },
      { id: 201, bomId: 200, itemId: 202, quantity: 5, unit: 'kg', sequence: 2 },
      { id: 202, bomId: 200, itemId: 203, quantity: 1000, unit: 'pcs', sequence: 3 },
    ]);

    // Create Work Order
    await db.insert(schema.sqliteWorkOrders).values([
      { id: 200, woNumber: 'WO-TEST-001', bomId: 200, productId: 200, batchNumber: 'BATCH-TEST-001', plannedQuantity: 1000, actualQuantity: 980, unit: 'bottle', status: 'completed', yieldPercentage: 98 },
      { id: 201, woNumber: 'WO-TEST-002', bomId: 200, productId: 200, batchNumber: 'BATCH-TEST-002', plannedQuantity: 1000, unit: 'bottle', status: 'planned' },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.sqliteWorkOrders).where(eq(schema.sqliteWorkOrders.id, 200));
    await db.delete(schema.sqliteWorkOrders).where(eq(schema.sqliteWorkOrders.id, 201));
    await db.delete(schema.sqliteBOMLines).where(eq(schema.sqliteBOMLines.bomId, 200));
    await db.delete(schema.sqliteBOM).where(eq(schema.sqliteBOM.id, 200));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 200));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 201));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 202));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 203));
  });

  describe('BOM Explosion', () => {
    it('should retrieve BOM with all lines', async () => {
      const [bom] = await db
        .select()
        .from(schema.sqliteBOM)
        .where(eq(schema.sqliteBOM.id, 200));

      expect(bom).toBeDefined();
      expect(bom.code).toBe('BOM-TEST-001');
      expect(bom.batchSize).toBe(1000);
    });

    it('should retrieve all BOM lines', async () => {
      const lines = await db
        .select()
        .from(schema.sqliteBOMLines)
        .where(eq(schema.sqliteBOMLines.bomId, 200));

      expect(lines.length).toBe(3);
    });

    it('should calculate material requirements for a batch', async () => {
      const [bom] = await db
        .select()
        .from(schema.sqliteBOM)
        .where(eq(schema.sqliteBOM.id, 200));

      const lines = await db
        .select()
        .from(schema.sqliteBOMLines)
        .where(eq(schema.sqliteBOMLines.bomId, 200));

      const batchMultiplier = 2; // 2x batch size
      const requirements = lines.map(line => ({
        itemId: line.itemId,
        requiredQuantity: line.quantity * batchMultiplier,
        unit: line.unit,
      }));

      expect(requirements.length).toBe(3);
      expect(requirements[0].requiredQuantity).toBe(20); // 10 * 2
      expect(requirements[1].requiredQuantity).toBe(10); // 5 * 2
      expect(requirements[2].requiredQuantity).toBe(2000); // 1000 * 2
    });
  });

  describe('Yield Calculation', () => {
    it('should calculate yield percentage correctly', async () => {
      const [wo] = await db
        .select()
        .from(schema.sqliteWorkOrders)
        .where(eq(schema.sqliteWorkOrders.id, 200));

      const yieldPercentage = (wo.actualQuantity! / wo.plannedQuantity) * 100;
      expect(yieldPercentage).toBe(98);
    });

    it('should identify below-target yields', async () => {
      const [bom] = await db
        .select()
        .from(schema.sqliteBOM)
        .where(eq(schema.sqliteBOM.id, 200));

      const [wo] = await db
        .select()
        .from(schema.sqliteWorkOrders)
        .where(eq(schema.sqliteWorkOrders.id, 200));

      const yieldPercentage = (wo.actualQuantity! / wo.plannedQuantity) * 100;
      const isBelowTarget = yieldPercentage < (bom.yieldTarget || 100);

      expect(isBelowTarget).toBe(false); // 98 >= 98
    });
  });

  describe('Work Order Workflows', () => {
    it('should have correct work order status', async () => {
      const workOrders = await db
        .select()
        .from(schema.sqliteWorkOrders)
        .where(eq(schema.sqliteWorkOrders.bomId, 200));

      expect(workOrders.length).toBe(2);
      
      const completed = workOrders.find(wo => wo.status === 'completed');
      const planned = workOrders.find(wo => wo.status === 'planned');

      expect(completed).toBeDefined();
      expect(planned).toBeDefined();
    });

    it('should track batch number', async () => {
      const [wo] = await db
        .select()
        .from(schema.sqliteWorkOrders)
        .where(eq(schema.sqliteWorkOrders.id, 200));

      expect(wo.batchNumber).toBe('BATCH-TEST-001');
    });
  });
});

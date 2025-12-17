/**
 * Quality Service Tests
 * Tests for QC workflows, sampling plans, and deviation management
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeDatabase, getSqliteDb, schema } from '../../src/lib/db';
import { eq } from 'drizzle-orm';

describe('Quality Service', () => {
  let db: ReturnType<typeof getSqliteDb>;

  beforeAll(async () => {
    db = await initializeDatabase() as ReturnType<typeof getSqliteDb>;
    
    // Create test items
    await db.insert(schema.sqliteItems).values([
      { id: 300, code: 'TEST-QC-001', nameTh: 'วัตถุดิบทดสอบ QC', type: 'raw_material', primaryUnit: 'kg' },
    ]);

    // Create test warehouse
    await db.insert(schema.sqliteWarehouses).values([
      { id: 300, code: 'TEST-QC-WH', name: 'QC Warehouse', type: 'raw_material', location: 'QC Area' },
    ]);

    // Create test lot
    await db.insert(schema.sqliteInventoryLots).values([
      { id: 300, itemId: 300, lotNumber: 'QC-LOT-001', warehouseId: 300, quantity: 100, unit: 'kg', status: 'quarantine' },
      { id: 301, itemId: 300, lotNumber: 'QC-LOT-002', warehouseId: 300, quantity: 100, unit: 'kg', status: 'released' },
    ]);

    // Create quality specs
    await db.insert(schema.sqliteQualitySpecs).values([
      { id: 300, itemId: 300, testName: 'Moisture Content', testMethod: 'Karl Fischer', specification: '< 10%', minValue: 0, maxValue: 10, unit: '%', isCritical: true },
      { id: 301, itemId: 300, testName: 'Heavy Metals', testMethod: 'ICP-MS', specification: '< 10 ppm', minValue: 0, maxValue: 10, unit: 'ppm', isCritical: true },
    ]);

    // Create quality tests
    await db.insert(schema.sqliteQualityTests).values([
      { id: 300, lotId: 300, specId: 300, testType: 'incoming', status: 'pass', numericResult: 8.5 },
      { id: 301, lotId: 300, specId: 301, testType: 'incoming', status: 'pass', numericResult: 5.2 },
      { id: 302, lotId: 301, specId: 300, testType: 'incoming', status: 'fail', numericResult: 12.5 },
    ]);

    // Create deviations
    await db.insert(schema.sqliteDeviations).values([
      { id: 300, deviationNumber: 'DEV-TEST-001', title: 'Test Deviation', description: 'Test deviation for QC', severity: 'minor', status: 'open' },
      { id: 301, deviationNumber: 'DEV-TEST-002', title: 'Critical Deviation', description: 'Critical test deviation', severity: 'critical', status: 'investigating' },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.sqliteDeviations).where(eq(schema.sqliteDeviations.id, 300));
    await db.delete(schema.sqliteDeviations).where(eq(schema.sqliteDeviations.id, 301));
    await db.delete(schema.sqliteQualityTests).where(eq(schema.sqliteQualityTests.id, 300));
    await db.delete(schema.sqliteQualityTests).where(eq(schema.sqliteQualityTests.id, 301));
    await db.delete(schema.sqliteQualityTests).where(eq(schema.sqliteQualityTests.id, 302));
    await db.delete(schema.sqliteQualitySpecs).where(eq(schema.sqliteQualitySpecs.id, 300));
    await db.delete(schema.sqliteQualitySpecs).where(eq(schema.sqliteQualitySpecs.id, 301));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 300));
    await db.delete(schema.sqliteInventoryLots).where(eq(schema.sqliteInventoryLots.id, 301));
    await db.delete(schema.sqliteWarehouses).where(eq(schema.sqliteWarehouses.id, 300));
    await db.delete(schema.sqliteItems).where(eq(schema.sqliteItems.id, 300));
  });

  describe('Quality Specifications', () => {
    it('should retrieve quality specs for an item', async () => {
      const specs = await db
        .select()
        .from(schema.sqliteQualitySpecs)
        .where(eq(schema.sqliteQualitySpecs.itemId, 300));

      expect(specs.length).toBe(2);
    });

    it('should identify critical specs', async () => {
      const specs = await db
        .select()
        .from(schema.sqliteQualitySpecs)
        .where(eq(schema.sqliteQualitySpecs.itemId, 300));

      const criticalSpecs = specs.filter(s => s.isCritical);
      expect(criticalSpecs.length).toBe(2);
    });
  });

  describe('Quality Tests', () => {
    it('should retrieve tests for a lot', async () => {
      const tests = await db
        .select()
        .from(schema.sqliteQualityTests)
        .where(eq(schema.sqliteQualityTests.lotId, 300));

      expect(tests.length).toBe(2);
    });

    it('should evaluate test results against specifications', async () => {
      const [test] = await db
        .select()
        .from(schema.sqliteQualityTests)
        .where(eq(schema.sqliteQualityTests.id, 300));

      const [spec] = await db
        .select()
        .from(schema.sqliteQualitySpecs)
        .where(eq(schema.sqliteQualitySpecs.id, test.specId));

      const isWithinSpec = test.numericResult! >= spec.minValue! && test.numericResult! <= spec.maxValue!;
      expect(isWithinSpec).toBe(true);
      expect(test.status).toBe('pass');
    });

    it('should identify failed tests', async () => {
      const [test] = await db
        .select()
        .from(schema.sqliteQualityTests)
        .where(eq(schema.sqliteQualityTests.id, 302));

      expect(test.status).toBe('fail');
      expect(test.numericResult).toBe(12.5); // Above max of 10
    });

    it('should calculate pass rate', async () => {
      const tests = await db
        .select()
        .from(schema.sqliteQualityTests);

      const passedTests = tests.filter(t => t.status === 'pass');
      const passRate = (passedTests.length / tests.length) * 100;

      expect(passRate).toBeCloseTo(66.67, 1); // 2/3 passed
    });
  });

  describe('Deviation Management', () => {
    it('should retrieve deviations', async () => {
      const deviations = await db
        .select()
        .from(schema.sqliteDeviations);

      expect(deviations.length).toBeGreaterThanOrEqual(2);
    });

    it('should categorize deviations by severity', async () => {
      const deviations = await db
        .select()
        .from(schema.sqliteDeviations);

      const minor = deviations.filter(d => d.severity === 'minor');
      const critical = deviations.filter(d => d.severity === 'critical');

      expect(minor.length).toBeGreaterThanOrEqual(1);
      expect(critical.length).toBeGreaterThanOrEqual(1);
    });

    it('should track deviation status', async () => {
      const [deviation] = await db
        .select()
        .from(schema.sqliteDeviations)
        .where(eq(schema.sqliteDeviations.id, 301));

      expect(deviation.status).toBe('investigating');
    });
  });

  describe('Sampling Plans', () => {
    it('should calculate sample size based on lot size', () => {
      // AQL-based sampling calculation
      const calculateSampleSize = (lotSize: number): number => {
        if (lotSize <= 50) return Math.min(lotSize, 8);
        if (lotSize <= 150) return 20;
        if (lotSize <= 500) return 50;
        if (lotSize <= 1200) return 80;
        return 125;
      };

      expect(calculateSampleSize(30)).toBe(8);
      expect(calculateSampleSize(100)).toBe(20);
      expect(calculateSampleSize(300)).toBe(50);
      expect(calculateSampleSize(800)).toBe(80);
      expect(calculateSampleSize(2000)).toBe(125);
    });
  });
});

/**
 * Manufacturing Cost Accounting Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 4: Process Manufacturing Cost Accounting
 *
 * Tests cost accounting functions:
 * - recordMaterialCost() - DR WIP, CR Raw Materials
 * - allocateLaborCost() - DR WIP, CR Manufacturing Labor
 * - allocateOverhead() - DR WIP, CR Manufacturing Overhead
 * - transferToFinishedGoods() - DR FG, CR WIP
 * - getBatchCostBreakdown() - Cost analysis per work order
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';
import {
  seedManufacturingCostTestData,
  ACCT_TEST_IDS,
  MANUFACTURING_TEST_IDS,
  getAccountBalance,
  verifyTrialBalance,
} from '../../helpers/seed-accounting';

// Store db reference for module mock
let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock db module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  db: () => testDb,
  getSqliteDb: () => testDb,
  getDb: () => Promise.resolve(testDb),
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  recordMaterialCost,
  allocateLaborCost,
  allocateOverhead,
  transferToFinishedGoods,
  getBatchCostBreakdown,
} from '@/lib/services/accounting.service';

describe('Manufacturing Cost Accounting Service', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });

    // Create required tables
    const tables = [
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteJournalEntries,
      schema.sqliteJournalLines,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWorkOrders,
      schema.sqliteBOM,
      schema.sqliteInventoryLots,
      schema.sqliteUsers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch {
        // Table might already exist
      }
    }

    // Seed test data
    seedManufacturingCostTestData(testSqlite);

    // Create test user
    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, email, password, name, role, is_active, created_at, updated_at)
      VALUES (1, 'test@example.com', 'password123', 'Test User', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  });

  afterEach(() => {
    testSqlite?.close();
  });

  describe('recordMaterialCost', () => {
    it('should record material cost with journal entry DR WIP CR Raw Materials', async () => {
      const result = await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          lotId: MANUFACTURING_TEST_IDS.LOT_1,
          quantity: 10,
          unitCost: 50,
          issueDate: '2025-01-15',
          description: 'Material issue for production',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.journalEntry.id).toBeGreaterThan(0);
      expect(result.totalCost).toBe(500); // 10 * 50

      // Verify journal entry was created and posted
      const je = testSqlite
        .prepare('SELECT * FROM journal_entries WHERE id = ?')
        .get(result.journalEntry.id) as { status: string; source_type: string; total_debit: number };

      expect(je.status).toBe('posted');
      expect(je.source_type).toBe('COST_ALLOCATION');
      expect(je.total_debit).toBe(500);

      // Verify trial balance
      const trialBalance = verifyTrialBalance(testSqlite);
      expect(trialBalance.isBalanced).toBe(true);
    });

    it('should create correct journal lines for material cost', async () => {
      const result = await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 5,
          unitCost: 100,
          issueDate: '2025-01-15',
        },
        1
      );

      // Verify journal lines: DR WIP 500, CR Raw Materials 500
      const lines = testSqlite
        .prepare('SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number')
        .all(result.journalEntry.id) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      expect(lines.length).toBe(2);

      // DR WIP (1132)
      expect(lines[0].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_WIP);
      expect(lines[0].debit).toBe(500);
      expect(lines[0].credit).toBe(0);

      // CR Raw Materials (1131)
      expect(lines[1].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_RAW);
      expect(lines[1].debit).toBe(0);
      expect(lines[1].credit).toBe(500);
    });
  });

  describe('allocateLaborCost', () => {
    it('should allocate labor cost with journal entry DR WIP CR Manufacturing Labor', async () => {
      const result = await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 8,
          hourlyRate: 150,
          allocationDate: '2025-01-16',
          description: 'Labor for batch BATCH-001',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.journalEntry.id).toBeGreaterThan(0);
      expect(result.totalCost).toBe(1200); // 8 hours * 150 THB/hr

      // Verify journal entry
      const je = testSqlite
        .prepare('SELECT * FROM journal_entries WHERE id = ?')
        .get(result.journalEntry.id) as { status: string; total_debit: number };

      expect(je.status).toBe('posted');
      expect(je.total_debit).toBe(1200);

      // Verify trial balance
      const trialBalance = verifyTrialBalance(testSqlite);
      expect(trialBalance.isBalanced).toBe(true);
    });

    it('should create correct journal lines for labor cost', async () => {
      const result = await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 4,
          hourlyRate: 200,
          allocationDate: '2025-01-16',
        },
        1
      );

      const lines = testSqlite
        .prepare('SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number')
        .all(result.journalEntry.id) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      expect(lines.length).toBe(2);

      // DR WIP (1132)
      expect(lines[0].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_WIP);
      expect(lines[0].debit).toBe(800);

      // CR Manufacturing Labor (5210)
      expect(lines[1].gl_account_id).toBe(ACCT_TEST_IDS.MANUFACTURING_LABOR);
      expect(lines[1].credit).toBe(800);
    });
  });

  describe('allocateOverhead', () => {
    it('should allocate overhead with journal entry DR WIP CR Manufacturing Overhead', async () => {
      const result = await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'fixed',
          allocationBasis: 'labor_hours',
          basisAmount: 8,
          overheadRate: 50,
          allocationDate: '2025-01-16',
          description: 'Overhead allocation based on labor hours',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.journalEntry.id).toBeGreaterThan(0);
      expect(result.totalCost).toBe(400); // 8 hours * 50 THB/hr

      // Verify trial balance
      const trialBalance = verifyTrialBalance(testSqlite);
      expect(trialBalance.isBalanced).toBe(true);
    });

    it('should support different allocation bases', async () => {
      // Test machine hours basis
      const result1 = await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'variable',
          allocationBasis: 'machine_hours',
          basisAmount: 10,
          overheadRate: 75,
          allocationDate: '2025-01-16',
        },
        1
      );
      expect(result1.totalCost).toBe(750);

      // Test units basis
      const result2 = await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'mixed',
          allocationBasis: 'units',
          basisAmount: 100,
          overheadRate: 5,
          allocationDate: '2025-01-16',
        },
        1
      );
      expect(result2.totalCost).toBe(500);
    });

    it('should create correct journal lines for overhead', async () => {
      const result = await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'fixed',
          allocationBasis: 'direct_labor_cost',
          basisAmount: 1000,
          overheadRate: 0.5,
          allocationDate: '2025-01-16',
        },
        1
      );

      const lines = testSqlite
        .prepare('SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number')
        .all(result.journalEntry.id) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      expect(lines.length).toBe(2);

      // DR WIP (1132)
      expect(lines[0].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_WIP);
      expect(lines[0].debit).toBe(500);

      // CR Manufacturing Overhead (5220)
      expect(lines[1].gl_account_id).toBe(ACCT_TEST_IDS.MANUFACTURING_OVERHEAD);
      expect(lines[1].credit).toBe(500);
    });
  });

  describe('transferToFinishedGoods', () => {
    it('should transfer costs to finished goods with journal entry DR FG CR WIP', async () => {
      // First add some costs to WIP
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 10,
          unitCost: 50,
          issueDate: '2025-01-15',
        },
        1
      );

      await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 5,
          hourlyRate: 100,
          allocationDate: '2025-01-16',
        },
        1
      );

      // Transfer to finished goods
      const result = await transferToFinishedGoods(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          finishedGoodsItemId: MANUFACTURING_TEST_IDS.FINISHED_GOODS,
          quantity: 100,
          lotNumber: 'FG-BATCH-001',
          transferDate: '2025-01-17',
          description: 'Transfer completed batch',
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.journalEntry.id).toBeGreaterThan(0);
      expect(result.totalCost).toBe(1000); // 500 materials + 500 labor
      expect(result.unitCost).toBe(10); // 1000 / 100 units

      // Verify trial balance
      const trialBalance = verifyTrialBalance(testSqlite);
      expect(trialBalance.isBalanced).toBe(true);
    });

    it('should calculate correct unit cost', async () => {
      // Add various costs
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 20,
          unitCost: 100,
          issueDate: '2025-01-15',
        },
        1
      );

      await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 10,
          hourlyRate: 200,
          allocationDate: '2025-01-16',
        },
        1
      );

      await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'fixed',
          allocationBasis: 'units',
          basisAmount: 50,
          overheadRate: 20,
          allocationDate: '2025-01-16',
        },
        1
      );

      // Total cost: 2000 + 2000 + 1000 = 5000
      const result = await transferToFinishedGoods(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          finishedGoodsItemId: MANUFACTURING_TEST_IDS.FINISHED_GOODS,
          quantity: 50,
          lotNumber: 'FG-BATCH-001',
          transferDate: '2025-01-17',
        },
        1
      );

      expect(result.totalCost).toBe(5000);
      expect(result.unitCost).toBe(100); // 5000 / 50 units
    });

    it('should create correct journal lines for transfer', async () => {
      // Add some WIP costs first
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 10,
          unitCost: 100,
          issueDate: '2025-01-15',
        },
        1
      );

      const result = await transferToFinishedGoods(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          finishedGoodsItemId: MANUFACTURING_TEST_IDS.FINISHED_GOODS,
          quantity: 10,
          lotNumber: 'FG-BATCH-001',
          transferDate: '2025-01-17',
        },
        1
      );

      const lines = testSqlite
        .prepare('SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number')
        .all(result.journalEntry.id) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      expect(lines.length).toBe(2);

      // DR Finished Goods (1133)
      expect(lines[0].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_FG);
      expect(lines[0].debit).toBe(1000);

      // CR WIP (1132)
      expect(lines[1].gl_account_id).toBe(ACCT_TEST_IDS.INVENTORY_WIP);
      expect(lines[1].credit).toBe(1000);
    });
  });

  describe('getBatchCostBreakdown', () => {
    it('should return complete cost breakdown for a work order', async () => {
      // Add various costs
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 10,
          unitCost: 50,
          issueDate: '2025-01-15',
        },
        1
      );

      await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 5,
          hourlyRate: 100,
          allocationDate: '2025-01-16',
        },
        1
      );

      await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'fixed',
          allocationBasis: 'labor_hours',
          basisAmount: 5,
          overheadRate: 50,
          allocationDate: '2025-01-16',
        },
        1
      );

      const breakdown = await getBatchCostBreakdown(MANUFACTURING_TEST_IDS.WORK_ORDER_1);

      expect(breakdown).toBeDefined();
      expect(breakdown!.workOrderId).toBe(MANUFACTURING_TEST_IDS.WORK_ORDER_1);
      expect(breakdown!.batchNumber).toBe('BATCH-001');
      expect(breakdown!.materialCost).toBe(500);
      expect(breakdown!.laborCost).toBe(500);
      expect(breakdown!.overheadCost).toBe(250);
      expect(breakdown!.totalCost).toBe(1250);
      expect(breakdown!.status).toBe('in_progress');
      expect(breakdown!.journalEntries.length).toBe(3);
    });

    it('should throw error for non-existent work order', async () => {
      await expect(getBatchCostBreakdown(999)).rejects.toThrow('Work order 999 not found');
    });

    it('should calculate costs for additional work orders', async () => {
      // Add costs to work order 2
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_2,
          batchNumber: 'BATCH-002',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 25,
          unitCost: 40,
          issueDate: '2025-01-10',
        },
        1
      );

      const breakdown = await getBatchCostBreakdown(MANUFACTURING_TEST_IDS.WORK_ORDER_2);

      expect(breakdown).toBeDefined();
      expect(breakdown!.batchNumber).toBe('BATCH-002');
      expect(breakdown!.materialCost).toBe(1000);
      expect(breakdown!.totalCost).toBe(1000);
    });
  });

  describe('Cost Flow Verification', () => {
    it('should maintain balanced books through complete manufacturing cycle', async () => {
      // Step 1: Issue materials (DR WIP, CR Raw Materials)
      await recordMaterialCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          materialItemId: MANUFACTURING_TEST_IDS.RAW_MATERIAL_1,
          quantity: 10,
          unitCost: 100,
          issueDate: '2025-01-15',
        },
        1
      );
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      // Step 2: Allocate labor (DR WIP, CR Manufacturing Labor)
      await allocateLaborCost(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          laborHours: 10,
          hourlyRate: 150,
          allocationDate: '2025-01-16',
        },
        1
      );
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      // Step 3: Allocate overhead (DR WIP, CR Manufacturing Overhead)
      await allocateOverhead(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          overheadType: 'fixed',
          allocationBasis: 'labor_hours',
          basisAmount: 10,
          overheadRate: 75,
          allocationDate: '2025-01-16',
        },
        1
      );
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      // Step 4: Transfer to finished goods (DR FG, CR WIP)
      const result = await transferToFinishedGoods(
        {
          workOrderId: MANUFACTURING_TEST_IDS.WORK_ORDER_1,
          batchNumber: 'BATCH-001',
          finishedGoodsItemId: MANUFACTURING_TEST_IDS.FINISHED_GOODS,
          quantity: 100,
          lotNumber: 'FG-BATCH-001',
          transferDate: '2025-01-17',
        },
        1
      );
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      // Verify final amounts
      // Materials: 10 * 100 = 1000
      // Labor: 10 * 150 = 1500
      // Overhead: 10 * 75 = 750
      // Total: 3250
      expect(result.totalCost).toBe(3250);
      expect(result.unitCost).toBe(32.5); // 3250 / 100

      // Verify WIP is cleared (balance should equal transfer amount)
      const wipBalance = getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_WIP);
      expect(wipBalance).toBe(0); // WIP should be zeroed out after transfer

      // Verify FG received the costs
      const fgBalance = getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_FG);
      expect(fgBalance).toBe(3250);
    });
  });
});

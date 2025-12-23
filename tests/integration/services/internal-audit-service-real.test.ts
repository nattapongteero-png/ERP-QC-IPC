/**
 * Internal Audit Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Internal Audit module functionality with real-world scenarios.
 *
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// ============================================
// Test Constants (inline to avoid import issues)
// ============================================
const TEST_USER_IDS = {
  QA_MANAGER: 1,
  LEAD_AUDITOR: 2,
  AUDITOR: 3,
  AUDITEE: 4,
};

const now = new Date();
const year = now.getFullYear();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  PAST_DATE: `${year - 1}-06-15`,
  FUTURE_DATE: `${year + 1}-06-15`,
  NEAR_FUTURE: `${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01`,
};

// GMP Chapter references
const GMP_CHAPTERS = [
  'หมวด 1 - การบริหารและการจัดองค์กร',
  'หมวด 2 - บุคลากร',
  'หมวด 3 - อาคารสถานที่และสิ่งอำนวยความสะดวก',
  'หมวด 7 - การดำเนินการผลิต',
  'หมวด 8 - การควบคุมคุณภาพ',
];

// ============================================
// Schema Sync Helper (inline)
// ============================================
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;

    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        def += 'INTEGER';
        break;
      case 'boolean':
        def += 'INTEGER';
        break;
      default:
        def += 'TEXT';
    }

    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    if (col.notNull && !col.primary) {
      def += ' NOT NULL';
    }

    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string'
        ? `'${col.default}'`
        : col.default;
      if (defaultVal !== null && typeof defaultVal !== 'function') {
        def += ` DEFAULT ${defaultVal}`;
      }
    }

    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module to use our test database
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service after mocking
import {
  getAuditPlans,
  getAuditPlanById,
  createAuditPlan,
  updateAuditPlan,
  approveAuditPlan,
  generateAuditNumber,
  getAudits,
  getAuditById,
  createAudit,
  updateAudit,
  startAudit,
  completeAudit,
  getAuditFindings,
  getAuditFindingById,
  createAuditFinding,
  updateAuditFinding,
  assignCapaToFinding,
  closeAuditFinding,
  getAuditStatistics,
  getChapterCoverage,
} from '@/lib/services/internal-audit-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteCapa,
    schema.sqliteCapaActions,
    schema.sqliteCapaEffectiveness,
    schema.sqliteAuditPlans,
    schema.sqliteAudits,
    schema.sqliteAuditFindings,
  ];

  for (const table of tablesToCreate) {
    try {
      const createSql = generateCreateTableSql(table);
      sqlite.exec(createSql);
    } catch (err) {
      console.log(`Table creation note: ${err}`);
    }
  }
}

describe('Internal Audit Service Real Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up test environment...');
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Use schema-sync to create tables from Drizzle schema
    syncSchemaFromDrizzle();
    seedTestData();
  });

  afterAll(() => {
    console.log('Cleaning up test environment...');
    sqlite.close();
  });

  beforeEach(() => {
    // Clean audit-related data before each test
    cleanAuditTables();
    seedTestData();
  });

  function cleanAuditTables() {
    sqlite.exec('DELETE FROM audit_findings');
    sqlite.exec('DELETE FROM audits');
    sqlite.exec('DELETE FROM audit_plans');
    sqlite.exec('DELETE FROM capa_effectiveness');
    sqlite.exec('DELETE FROM capa_actions');
    sqlite.exec('DELETE FROM capa');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    // Create test users
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (${TEST_USER_IDS.LEAD_AUDITOR}, 'Lead Auditor', 'lead.auditor@test.com', 'hash123', 'lead_auditor', 1),
        (${TEST_USER_IDS.AUDITOR}, 'Auditor', 'auditor@test.com', 'hash123', 'auditor', 1),
        (${TEST_USER_IDS.AUDITEE}, 'Auditee', 'auditee@test.com', 'hash123', 'operator', 1)
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Complete Audit Cycle (plan -> schedule -> conduct -> findings -> CAPA -> close)', () => {
    it('should handle complete annual audit lifecycle', async () => {
      // Step 1: Create annual audit plan
      const plan = await createAuditPlan({
        planYear: year,
        name: `GMP Internal Audit Plan ${year}`,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(plan.id).toBeDefined();
      expect(plan.planYear).toBe(year);
      expect(plan.status).toBe('draft');

      // Step 2: Approve the plan
      const approvedPlan = await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);
      expect(approvedPlan.status).toBe('approved');
      expect(approvedPlan.approvedBy).toBe(TEST_USER_IDS.QA_MANAGER);

      // Step 3: Schedule an audit
      const audit = await createAudit({
        planId: plan.id,
        auditType: 'internal',
        scope: 'หมวด 7 - การดำเนินการผลิต',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
        auditTeam: [TEST_USER_IDS.AUDITOR],
        objectives: 'ตรวจประเมินกระบวนการผลิตตามมาตรฐาน GMP',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(audit.id).toBeDefined();
      expect(audit.auditNumber).toMatch(/^AUD-\d{4}-\d{4}$/);
      expect(audit.status).toBe('scheduled');

      // Step 4: Start the audit
      const startedAudit = await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);
      expect(startedAudit.status).toBe('in_progress');
      expect(startedAudit.actualDate).toBeDefined();

      // Step 5: Record findings
      const finding1 = await createAuditFinding({
        auditId: audit.id,
        category: 'major',
        gmpChapter: 7,
        gmpRequirement: 'Line clearance must be performed and documented before each batch',
        description: 'Line clearance checklist was not completed for Batch LOT-2501-0001',
        evidence: 'Missing documentation for batch LOT-2501-0001',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(finding1.id).toBeDefined();
      expect(finding1.status).toBe('open');

      const finding2 = await createAuditFinding({
        auditId: audit.id,
        category: 'observation',
        gmpChapter: 7,
        gmpRequirement: 'Equipment status labels should be current',
        description: 'Some equipment status labels were outdated',
        evidence: 'Visual inspection evidence',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(finding2.category).toBe('observation');

      // Step 6: Complete the audit
      const completedAudit = await completeAudit(audit.id, {
        summary: 'Audit identified 1 major finding and 1 observation requiring attention.',
        reportPath: '/reports/audit-2025-001.pdf',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(completedAudit.status).toBe('completed');
      expect(completedAudit.summary).toContain('major finding');

      // Step 7: Get audit details with findings
      const auditDetails = await getAuditById(audit.id);
      expect(auditDetails).not.toBeNull();
      expect(auditDetails!.findings.length).toBe(2);
    });
  });

  describe('Scenario 2: Finding Classification and CAPA Linkage', () => {
    it('should link CAPA to major finding and track closure', async () => {
      // Setup: Create plan and audit
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      const audit = await createAudit({
        planId: plan.id,
        auditType: 'internal',
        scope: 'หมวด 8 - การควบคุมคุณภาพ',
        gmpChapters: [8],
        scheduledDate: TEST_DATES.TODAY,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);

      // Create critical finding that requires CAPA
      const finding = await createAuditFinding({
        auditId: audit.id,
        category: 'critical',
        gmpChapter: 8,
        gmpRequirement: 'OOS results must be investigated within 24 hours',
        description: 'OOS investigation for batch LOT-2501-0005 was delayed by 5 days',
        evidence: 'Audit trail showing 5-day delay',
        capaRequired: true,
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(finding.category).toBe('critical');
      expect(finding.capaRequired).toBe(true);

      // Create CAPA for the finding
      sqlite.exec(`
        INSERT INTO capa (id, capa_number, title, source_type, source_id, type, priority, status, owner_id, due_date)
        VALUES (1, 'CAPA-${year}-0001', 'CAPA for OOS Investigation Delay', 'audit_finding', ${finding.id}, 'corrective', 'critical', 'open', ${TEST_USER_IDS.QA_MANAGER}, '${TEST_DATES.FUTURE_DATE}')
      `);

      // Link CAPA to finding
      const linkedFinding = await assignCapaToFinding(finding.id, 1, TEST_USER_IDS.QA_MANAGER);
      expect(linkedFinding.capaId).toBe(1);
      expect(linkedFinding.status).toBe('capa_assigned');

      // Complete CAPA (simulate)
      sqlite.exec(`UPDATE capa SET status = 'closed' WHERE id = 1`);

      // Close finding (only takes id and userId)
      const closedFinding = await closeAuditFinding(finding.id, TEST_USER_IDS.QA_MANAGER);

      expect(closedFinding.status).toBe('closed');
      expect(closedFinding.closedDate).toBeDefined();
    });
  });

  describe('Scenario 3: Supplier Audit Workflow', () => {
    it('should handle supplier audit with different audit type', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      const audit = await createAudit({
        planId: plan.id,
        auditType: 'supplier',
        scope: 'Raw Material Supplier - ABC Herbs Co.',
        gmpChapters: [3, 6], // Storage and production
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(audit.auditType).toBe('supplier');

      await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);

      // Record supplier-specific findings
      const finding = await createAuditFinding({
        auditId: audit.id,
        category: 'minor',
        gmpChapter: 3,
        gmpRequirement: 'Storage conditions must be monitored',
        description: 'Temperature monitoring was manual, not continuous',
        evidence: 'Inspection records',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(finding.status).toBe('open');

      // Update finding with corrective action info
      const updatedFinding = await updateAuditFinding(finding.id, {
        description: 'Temperature monitoring was manual, not continuous. Supplier will install continuous monitoring within 30 days.',
      }, TEST_USER_IDS.AUDITEE);

      expect(updatedFinding).not.toBeNull();
    });
  });

  // ============================================
  // Audit Plan Tests
  // ============================================

  describe('Audit Plan Management', () => {
    it('should create and list audit plans', async () => {
      await createAuditPlan({ planYear: year, name: 'Plan A' }, TEST_USER_IDS.QA_MANAGER);
      await createAuditPlan({ planYear: year - 1, name: 'Plan B' }, TEST_USER_IDS.QA_MANAGER);

      const plans = await getAuditPlans();
      expect(plans.length).toBe(2);
    });

    it('should filter plans by year', async () => {
      await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await createAuditPlan({ planYear: year - 1 }, TEST_USER_IDS.QA_MANAGER);

      const plans = await getAuditPlans({ year });
      expect(plans.length).toBe(1);
      expect(plans[0].planYear).toBe(year);
    });

    it('should filter plans by status', async () => {
      const plan1 = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await createAuditPlan({ planYear: year - 1 }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan1.id, TEST_USER_IDS.QA_MANAGER);

      const approvedPlans = await getAuditPlans({ status: 'approved' });
      expect(approvedPlans.length).toBe(1);
    });

    it('should update audit plan', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updateAuditPlan(plan.id, {
        name: 'Updated Plan Name',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated.name).toBe('Updated Plan Name');
    });

    it('should get plan by ID', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);

      const retrieved = await getAuditPlanById(plan.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(plan.id);
    });
  });

  // ============================================
  // Audit Tests
  // ============================================

  describe('Audit Management', () => {
    let planId: number;

    beforeEach(async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);
      planId = plan.id;
    });

    it('should generate unique audit numbers', async () => {
      const num1 = await generateAuditNumber();
      expect(num1).toMatch(/^AUD-\d{4}-0001$/);

      await createAudit({
        planId,
        auditType: 'internal',
        scope: 'Test',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      const num2 = await generateAuditNumber();
      expect(num2).toMatch(/^AUD-\d{4}-0002$/);
    });

    it('should create audit with all fields', async () => {
      const audit = await createAudit({
        planId,
        auditType: 'internal',
        scope: 'Production Area',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
        auditTeam: [TEST_USER_IDS.AUDITOR],
        objectives: 'Verify compliance',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(audit.auditType).toBe('internal');
      expect(audit.scope).toBe('Production Area');
      expect(audit.status).toBe('scheduled');
    });

    it('should list audits with filters', async () => {
      await createAudit({
        planId,
        auditType: 'internal',
        scope: 'Area A',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      await createAudit({
        planId,
        auditType: 'supplier',
        scope: 'Supplier B',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      const internalAudits = await getAudits({ auditType: 'internal' });
      expect(internalAudits.audits.length).toBe(1);
    });

    it('should update audit details', async () => {
      const audit = await createAudit({
        planId,
        auditType: 'internal',
        scope: 'Original Scope',
        scheduledDate: TEST_DATES.NEAR_FUTURE,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updateAudit(audit.id, {
        scope: 'Updated Scope',
        objectives: 'New objectives',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated.scope).toBe('Updated Scope');
    });

    it('should start and complete audit', async () => {
      const audit = await createAudit({
        planId,
        auditType: 'internal',
        scope: 'Test',
        scheduledDate: TEST_DATES.TODAY,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      const started = await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);
      expect(started.status).toBe('in_progress');

      const completed = await completeAudit(audit.id, {
        conclusion: 'Audit completed successfully',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      expect(completed.status).toBe('completed');
    });
  });

  // ============================================
  // Finding Tests
  // ============================================

  describe('Audit Finding Management', () => {
    let auditId: number;

    beforeEach(async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      const audit = await createAudit({
        planId: plan.id,
        auditType: 'internal',
        scope: 'Test',
        scheduledDate: TEST_DATES.TODAY,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);
      auditId = audit.id;
    });

    it('should create findings with all categories', async () => {
      const categories = ['critical', 'major', 'minor', 'observation'] as const;

      for (let i = 0; i < categories.length; i++) {
        const finding = await createAuditFinding({
          auditId,
          category: categories[i],
          gmpChapter: i + 1,
          gmpRequirement: `Requirement ${i + 1}`,
          description: `Finding description ${i + 1}`,
        }, TEST_USER_IDS.LEAD_AUDITOR);

        expect(finding.category).toBe(categories[i]);
      }
    });

    it('should list findings with filters', async () => {
      await createAuditFinding({
        auditId,
        category: 'critical',
        gmpChapter: 1,
        gmpRequirement: 'Req 1',
        description: 'Description 1',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      await createAuditFinding({
        auditId,
        category: 'minor',
        gmpChapter: 2,
        gmpRequirement: 'Req 2',
        description: 'Description 2',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      const criticalFindings = await getAuditFindings({ category: 'critical' });
      expect(criticalFindings.findings.length).toBe(1);
    });

    it('should get finding by ID', async () => {
      const finding = await createAuditFinding({
        auditId,
        category: 'major',
        gmpChapter: 7,
        gmpRequirement: 'Test requirement',
        description: 'Test observation',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      const retrieved = await getAuditFindingById(finding.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.gmpRequirement).toBe('Test requirement');
    });

    it('should update finding status through workflow', async () => {
      const finding = await createAuditFinding({
        auditId,
        category: 'minor',
        gmpChapter: 3,
        gmpRequirement: 'Req',
        description: 'Initial description',
        capaRequired: false,
      }, TEST_USER_IDS.LEAD_AUDITOR);

      // Update finding description
      const updated = await updateAuditFinding(finding.id, {
        description: 'Updated description with corrective action details',
      }, TEST_USER_IDS.AUDITEE);

      expect(updated).not.toBeNull();
      expect(updated!.description).toContain('Updated');

      // Close finding (no CAPA required)
      const closed = await closeAuditFinding(finding.id, TEST_USER_IDS.QA_MANAGER);

      expect(closed.status).toBe('closed');
    });
  });

  // ============================================
  // Statistics Tests
  // ============================================

  describe('Audit Statistics', () => {
    it('should calculate audit statistics for year', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      // Create first audit and complete it
      const audit1 = await createAudit({
        planId: plan.id,
        auditType: 'internal',
        scope: 'Area 1',
        gmpChapters: [1],
        scheduledDate: TEST_DATES.TODAY,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startAudit(audit1.id, TEST_USER_IDS.LEAD_AUDITOR);
      await completeAudit(audit1.id, { summary: 'Done' }, TEST_USER_IDS.LEAD_AUDITOR);

      const stats = await getAuditStatistics(year);

      // At least 1 audit planned and 1 completed
      expect(stats.totalPlanned).toBeGreaterThanOrEqual(1);
      expect(stats.totalCompleted).toBeGreaterThanOrEqual(1);
      expect(stats.year).toBe(year);
    });

    it('should calculate chapter coverage', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      // Create audits for different GMP chapters (1-3)
      for (let chapter = 1; chapter <= 3; chapter++) {
        const audit = await createAudit({
          planId: plan.id,
          auditType: 'internal',
          scope: `GMP Chapter ${chapter}`,
          gmpChapters: [chapter],
          scheduledDate: TEST_DATES.TODAY,
          leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
        }, TEST_USER_IDS.QA_MANAGER);

        await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);
        await completeAudit(audit.id, { summary: 'Complete' }, TEST_USER_IDS.LEAD_AUDITOR);
      }

      const coverage = await getChapterCoverage(year);

      // Coverage returns { year, chapters: [...] }
      expect(coverage.year).toBe(year);
      expect(coverage.chapters).toBeDefined();
      expect(coverage.chapters.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should return null for non-existent plan', async () => {
      const plan = await getAuditPlanById(99999);
      expect(plan).toBeNull();
    });

    it('should return null for non-existent audit', async () => {
      const audit = await getAuditById(99999);
      expect(audit).toBeNull();
    });

    it('should return null for non-existent finding', async () => {
      const finding = await getAuditFindingById(99999);
      expect(finding).toBeNull();
    });

    it('should return empty list when no audits exist', async () => {
      const result = await getAudits({});
      expect(result.audits.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle audit with no findings', async () => {
      const plan = await createAuditPlan({ planYear: year }, TEST_USER_IDS.QA_MANAGER);
      await approveAuditPlan(plan.id, TEST_USER_IDS.QA_MANAGER);

      const audit = await createAudit({
        planId: plan.id,
        auditType: 'internal',
        scope: 'Test',
        scheduledDate: TEST_DATES.TODAY,
        leadAuditorId: TEST_USER_IDS.LEAD_AUDITOR,
              }, TEST_USER_IDS.QA_MANAGER);

      await startAudit(audit.id, TEST_USER_IDS.LEAD_AUDITOR);
      const completed = await completeAudit(audit.id, {
        conclusion: 'No findings - full compliance',
      }, TEST_USER_IDS.LEAD_AUDITOR);

      const details = await getAuditById(completed.id);
      expect(details!.findings.length).toBe(0);
    });
  });
});

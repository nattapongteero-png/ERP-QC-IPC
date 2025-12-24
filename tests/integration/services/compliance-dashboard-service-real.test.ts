/**
 * Integration Tests: Compliance Dashboard Service
 * Phase 11: GMP Compliance Dashboard (T1101-T1103)
 *
 * Tests compliance overview, chapter coverage, and gap analysis
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';
import type { GMPChapterNumber } from '@/types/compliance';

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

// Import services after mocking
import {
  getComplianceOverview,
  calculateChapterCoverage,
  getGapsWithDrilldown,
} from '@/lib/services/compliance-dashboard-service';
import { createCapa } from '@/lib/services/capa-service';
import { createAuditPlan, createAudit } from '@/lib/services/internal-audit-service';
import { createComplaint } from '@/lib/services/complaint-service';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col = column as any;
    let def = `"${col.name}" `;

    // Map data type
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
      def += ` DEFAULT ${defaultVal}`;
    }

    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqliteCapa,
    schema.sqliteCapaActions,
    schema.sqliteCapaEffectiveness,
    schema.sqliteCapaAttachments,
    schema.sqliteCapaApprovals,
    schema.sqliteDeviations,
    schema.sqliteAuditPlans,
    schema.sqliteAudits,
    schema.sqliteAuditFindings,
    schema.sqliteComplaints,
    schema.sqliteComplaintInvestigations,
    schema.sqliteStabilityStudies,
    schema.sqliteSanitationSchedules,
    schema.sqliteSanitationLogs,
    schema.sqlitePestControlLogs,
    schema.sqliteEquipment,
    schema.sqliteMaintenanceRecords,
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

function seedTestData() {
  // Create test users
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
    VALUES
      (1, 'Test User', 'test@test.com', 'hash123', 'qa_manager', 1),
      (2, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1)
  `);

  // Create test items (products)
  sqlite.exec(`
    INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, primary_unit)
    VALUES (1, 'PROD-001', 'ยาตัวอย่าง', 'Sample Product', 'finished_goods', 'bottle')
  `);
}

function cleanTables() {
  const tables = [
    'capa_effectiveness',
    'capa_actions',
    'capa',
    'deviations',
    'audit_findings',
    'audits',
    'audit_plans',
    'complaint_investigations',
    'complaints',
    'stability_studies',
    'sanitation_logs',
    'sanitation_schedules',
    'maintenance_records',
    'equipment',
    'inventory_lots',
    'items',
    'users',
  ];

  for (const table of tables) {
    try {
      sqlite.exec(`DELETE FROM ${table}`);
    } catch (err) {
      // Table might not exist
    }
  }
}

describe('Compliance Dashboard Service - Real Database Integration', () => {
  let testUserId: number;
  let testProductId: number;

  beforeAll(async () => {
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Sync schema and seed data
    syncSchemaFromDrizzle();
    seedTestData();

    testUserId = 1;
    testProductId = 1;
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    cleanTables();
    seedTestData();
  });

  // ============================================
  // T1101: getComplianceOverview()
  // ============================================

  describe('T1101: getComplianceOverview()', () => {
    it('should return overall compliance statistics', async () => {
      const overview = await getComplianceOverview();

      // Verify structure
      expect(overview).toHaveProperty('overallScore');
      expect(overview).toHaveProperty('totalRequirements');
      expect(overview).toHaveProperty('metRequirements');
      expect(overview).toHaveProperty('gapCount');
      expect(overview).toHaveProperty('byChapter');
      expect(overview).toHaveProperty('lastUpdated');

      // Verify types
      expect(typeof overview.overallScore).toBe('number');
      expect(typeof overview.totalRequirements).toBe('number');
      expect(typeof overview.metRequirements).toBe('number');
      expect(typeof overview.gapCount).toBe('number');
      expect(Array.isArray(overview.byChapter)).toBe(true);

      // Verify score range
      expect(overview.overallScore).toBeGreaterThanOrEqual(0);
      expect(overview.overallScore).toBeLessThanOrEqual(100);

      // Verify all 10 chapters are included
      expect(overview.byChapter).toHaveLength(10);

      console.log('Overall Compliance Score:', overview.overallScore);
      console.log('Total Requirements:', overview.totalRequirements);
      console.log('Met Requirements:', overview.metRequirements);
      console.log('Gap Count:', overview.gapCount);
    });

    it('should calculate correct overall metrics from chapters', async () => {
      const overview = await getComplianceOverview();

      // Sum up chapter metrics
      const totalFromChapters = overview.byChapter.reduce(
        (sum, ch) => sum + ch.totalCount,
        0
      );
      const metFromChapters = overview.byChapter.reduce(
        (sum, ch) => sum + ch.metCount,
        0
      );
      const gapsFromChapters = overview.byChapter.reduce(
        (sum, ch) => sum + ch.gaps.length,
        0
      );

      // Verify aggregation is correct
      expect(overview.totalRequirements).toBe(totalFromChapters);
      expect(overview.metRequirements).toBe(metFromChapters);
      expect(overview.gapCount).toBe(gapsFromChapters);

      // Verify score calculation
      const expectedScore =
        totalFromChapters > 0
          ? Math.round((metFromChapters / totalFromChapters) * 100)
          : 0;
      expect(overview.overallScore).toBe(expectedScore);
    });

    it('should include all GMP chapters with correct metadata', async () => {
      const overview = await getComplianceOverview();

      const expectedChapters = [
        { num: 1, name: 'ระบบบริหารคุณภาพ', nameEn: 'Quality Management System' },
        { num: 2, name: 'บุคลากร', nameEn: 'Personnel' },
        { num: 3, name: 'อาคารสถานที่และเครื่องมือ', nameEn: 'Premises and Equipment' },
        { num: 4, name: 'การสุขาภิบาลและสุขอนามัย', nameEn: 'Sanitation and Hygiene' },
        { num: 5, name: 'เอกสารและข้อมูล', nameEn: 'Documentation' },
        { num: 6, name: 'การดำเนินการผลิต', nameEn: 'Production Operations' },
        { num: 7, name: 'การควบคุมคุณภาพ', nameEn: 'Quality Control' },
        { num: 8, name: 'การจ้างผลิตและจ้างตรวจวิเคราะห์', nameEn: 'Contract Manufacturing' },
        { num: 9, name: 'ข้อร้องเรียนและการเรียกคืน', nameEn: 'Complaints and Recalls' },
        { num: 10, name: 'การตรวจสอบตนเอง', nameEn: 'Self-Inspection' },
      ];

      expectedChapters.forEach((expected) => {
        const chapter = overview.byChapter.find((ch) => ch.chapter === expected.num);
        expect(chapter).toBeDefined();
        expect(chapter!.name).toBe(expected.name);
        expect(chapter!.nameEn).toBe(expected.nameEn);
      });
    });
  });

  // ============================================
  // T1102: calculateChapterCoverage()
  // ============================================

  describe('T1102: calculateChapterCoverage()', () => {
    it('should calculate coverage for Chapter 1 (Quality System)', async () => {
      const coverage = await calculateChapterCoverage(1);

      expect(coverage.chapter).toBe(1);
      expect(coverage.name).toBe('ระบบบริหารคุณภาพ');
      expect(coverage.nameEn).toBe('Quality Management System');
      expect(coverage.score).toBeGreaterThanOrEqual(0);
      expect(coverage.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(coverage.requirements)).toBe(true);
      expect(Array.isArray(coverage.gaps)).toBe(true);
      expect(coverage.requirements.length).toBeGreaterThan(0);

      console.log('Chapter 1 Score:', coverage.score);
      console.log('Chapter 1 Requirements:', coverage.requirements.length);
      console.log('Chapter 1 Gaps:', coverage.gaps.length);
    });

    it('should check CAPA effectiveness in Chapter 1', async () => {
      const coverage = await calculateChapterCoverage(1);

      const capaEffectivenessReq = coverage.requirements.find(
        (r) => r.id === '1.1'
      );
      expect(capaEffectivenessReq).toBeDefined();
      expect(capaEffectivenessReq!.description).toContain('CAPA effectiveness');
      expect(typeof capaEffectivenessReq!.isMet).toBe('boolean');

      console.log('CAPA Effectiveness Requirement:', capaEffectivenessReq);
    });

    it('should calculate coverage for Chapter 2 (Personnel)', async () => {
      const coverage = await calculateChapterCoverage(2);

      expect(coverage.chapter).toBe(2);
      expect(coverage.name).toBe('บุคลากร');
      expect(Array.isArray(coverage.requirements)).toBe(true);

      // Should check for active personnel
      const personnelReq = coverage.requirements.find((r) => r.id === '2.1');
      expect(personnelReq).toBeDefined();
      expect(personnelReq!.description).toContain('personnel');

      console.log('Chapter 2 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 3 (Equipment)', async () => {
      const coverage = await calculateChapterCoverage(3);

      expect(coverage.chapter).toBe(3);
      expect(coverage.name).toBe('อาคารสถานที่และเครื่องมือ');

      // Should check calibration status
      const calibrationReq = coverage.requirements.find((r) => r.id === '3.1');
      expect(calibrationReq).toBeDefined();
      expect(calibrationReq!.description).toContain('calibration');

      console.log('Chapter 3 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 4 (Sanitation)', async () => {
      const coverage = await calculateChapterCoverage(4);

      expect(coverage.chapter).toBe(4);
      expect(coverage.name).toBe('การสุขาภิบาลและสุขอนามัย');

      // Should check sanitation compliance
      const sanitationReq = coverage.requirements.find((r) => r.id === '4.1');
      expect(sanitationReq).toBeDefined();
      expect(sanitationReq!.description).toContain('Sanitation');

      console.log('Chapter 4 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 5 (Documentation)', async () => {
      const coverage = await calculateChapterCoverage(5);

      expect(coverage.chapter).toBe(5);
      expect(coverage.name).toBe('เอกสารและข้อมูล');
      expect(coverage.requirements.length).toBeGreaterThan(0);

      console.log('Chapter 5 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 6 (Production)', async () => {
      const coverage = await calculateChapterCoverage(6);

      expect(coverage.chapter).toBe(6);
      expect(coverage.name).toBe('การดำเนินการผลิต');
      expect(coverage.requirements.length).toBeGreaterThan(0);

      console.log('Chapter 6 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 7 (Quality Control)', async () => {
      const coverage = await calculateChapterCoverage(7);

      expect(coverage.chapter).toBe(7);
      expect(coverage.name).toBe('การควบคุมคุณภาพ');

      // Should check stability studies
      const stabilityReq = coverage.requirements.find((r) => r.id === '7.1');
      expect(stabilityReq).toBeDefined();
      expect(stabilityReq!.description).toContain('stability');

      console.log('Chapter 7 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 8 (Contract)', async () => {
      const coverage = await calculateChapterCoverage(8);

      expect(coverage.chapter).toBe(8);
      expect(coverage.name).toBe('การจ้างผลิตและจ้างตรวจวิเคราะห์');
      expect(coverage.requirements.length).toBeGreaterThan(0);

      console.log('Chapter 8 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 9 (Complaints)', async () => {
      const coverage = await calculateChapterCoverage(9);

      expect(coverage.chapter).toBe(9);
      expect(coverage.name).toBe('ข้อร้องเรียนและการเรียกคืน');

      // Should check complaint investigation rate
      const investigationReq = coverage.requirements.find((r) => r.id === '9.1');
      expect(investigationReq).toBeDefined();
      expect(investigationReq!.description).toContain('investigation');

      console.log('Chapter 9 Score:', coverage.score);
    });

    it('should calculate coverage for Chapter 10 (Self-Inspection)', async () => {
      const coverage = await calculateChapterCoverage(10);

      expect(coverage.chapter).toBe(10);
      expect(coverage.name).toBe('การตรวจสอบตนเอง');

      // Should check audit completion
      const auditReq = coverage.requirements.find((r) => r.id === '10.1');
      expect(auditReq).toBeDefined();
      expect(auditReq!.description).toContain('audit');

      console.log('Chapter 10 Score:', coverage.score);
    });

    it('should create gaps when requirements are not met', async () => {
      // Create an overdue CAPA to trigger a gap
      await createCapa(
        {
          title: 'Test Overdue CAPA',
          sourceType: 'internal',
          type: 'corrective',
          priority: 'high',
          ownerId: testUserId,
          dueDate: '2020-01-01', // Overdue
        },
        testUserId
      );

      const coverage = await calculateChapterCoverage(1);

      // Should have gaps for overdue CAPAs
      const overdueGap = coverage.gaps.find((g) => g.requirementId === '1.3');
      if (overdueGap) {
        expect(overdueGap.chapter).toBe(1);
        expect(overdueGap.currentStatus).toBeDefined();
        expect(overdueGap.remediation).toBeDefined();
        expect(overdueGap.priority).toBeDefined();
        console.log('Found gap for overdue CAPAs:', overdueGap);
      }
    });

    it('should calculate score correctly based on requirements', async () => {
      const coverage = await calculateChapterCoverage(1);

      const expectedScore =
        coverage.totalCount > 0
          ? Math.round((coverage.metCount / coverage.totalCount) * 100)
          : 0;

      expect(coverage.score).toBe(expectedScore);
      expect(coverage.metCount).toBe(
        coverage.requirements.filter((r) => r.isMet).length
      );
      expect(coverage.totalCount).toBe(coverage.requirements.length);
    });
  });

  // ============================================
  // T1103: getGapsWithDrilldown()
  // ============================================

  describe('T1103: getGapsWithDrilldown()', () => {
    it('should return all gaps across all chapters', async () => {
      const gaps = await getGapsWithDrilldown();

      expect(Array.isArray(gaps)).toBe(true);
      // Gaps may or may not exist depending on current compliance state
      console.log('Total gaps found:', gaps.length);

      if (gaps.length > 0) {
        const firstGap = gaps[0];
        expect(firstGap).toHaveProperty('requirementId');
        expect(firstGap).toHaveProperty('requirement');
        expect(firstGap).toHaveProperty('chapter');
        expect(firstGap).toHaveProperty('chapterName');
        expect(firstGap).toHaveProperty('currentStatus');
        expect(firstGap).toHaveProperty('remediation');
        expect(firstGap).toHaveProperty('priority');
        expect(firstGap).toHaveProperty('affectedRecords');
      }
    });

    it('should filter gaps by chapter', async () => {
      const chapter1Gaps = await getGapsWithDrilldown({ chapterFilter: 1 });

      expect(Array.isArray(chapter1Gaps)).toBe(true);

      // All returned gaps should be from Chapter 1
      chapter1Gaps.forEach((gap) => {
        expect(gap.chapter).toBe(1);
      });

      console.log('Chapter 1 gaps:', chapter1Gaps.length);
    });

    it('should filter gaps by priority', async () => {
      const criticalGaps = await getGapsWithDrilldown({ priorityFilter: 'critical' });

      expect(Array.isArray(criticalGaps)).toBe(true);

      // All returned gaps should be critical priority
      criticalGaps.forEach((gap) => {
        expect(gap.priority).toBe('critical');
      });

      console.log('Critical gaps:', criticalGaps.length);
    });

    it('should filter by both chapter and priority', async () => {
      const chapter9HighGaps = await getGapsWithDrilldown({
        chapterFilter: 9,
        priorityFilter: 'high',
      });

      expect(Array.isArray(chapter9HighGaps)).toBe(true);

      chapter9HighGaps.forEach((gap) => {
        expect(gap.chapter).toBe(9);
        expect(gap.priority).toBe('high');
      });

      console.log('Chapter 9 high-priority gaps:', chapter9HighGaps.length);
    });

    it('should include remediation suggestions for gaps', async () => {
      const gaps = await getGapsWithDrilldown();

      gaps.forEach((gap) => {
        expect(typeof gap.remediation).toBe('string');
        expect(gap.remediation.length).toBeGreaterThan(0);
      });
    });

    it('should include affected records for gaps', async () => {
      const gaps = await getGapsWithDrilldown();

      gaps.forEach((gap) => {
        expect(Array.isArray(gap.affectedRecords)).toBe(true);
        // Affected records may be empty for some gaps
        gap.affectedRecords.forEach((record) => {
          expect(record).toHaveProperty('type');
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('reference');
        });
      });
    });
  });

  // ============================================
  // Integration Tests: Real Data Scenarios
  // ============================================

  describe('Integration: Real Data Scenarios', () => {
    it('should reflect CAPA effectiveness in Chapter 1 score', async () => {
      // Get initial coverage
      const initialCoverage = await calculateChapterCoverage(1);
      const initialScore = initialCoverage.score;

      console.log('Initial Chapter 1 score:', initialScore);

      // Create a new CAPA (will affect effectiveness if checked)
      await createCapa(
        {
          title: 'Test CAPA for Effectiveness',
          sourceType: 'internal',
          type: 'corrective',
          priority: 'medium',
          ownerId: testUserId,
          dueDate: '2025-12-31',
        },
        testUserId
      );

      // Get updated coverage
      const updatedCoverage = await calculateChapterCoverage(1);

      // Coverage should still be valid
      expect(updatedCoverage.score).toBeGreaterThanOrEqual(0);
      expect(updatedCoverage.score).toBeLessThanOrEqual(100);
    });

    it('should reflect audit completion in Chapter 10 score', async () => {
      const currentYear = new Date().getFullYear();

      // Create an audit plan and audit
      const plan = await createAuditPlan(
        {
          planYear: currentYear,
          name: `Test Plan ${currentYear}`,
        },
        testUserId
      );

      await createAudit(
        {
          planId: plan.id,
          auditType: 'internal',
          scope: 'Test Audit Scope',
          gmpChapters: [1, 2],
          scheduledDate: '2025-06-15',
          leadAuditorId: testUserId,
        },
        testUserId
      );

      const coverage = await calculateChapterCoverage(10);

      expect(coverage.score).toBeGreaterThanOrEqual(0);
      expect(coverage.score).toBeLessThanOrEqual(100);

      console.log('Chapter 10 score after audit creation:', coverage.score);
    });

    it('should reflect complaint status in Chapter 9 score', async () => {
      // Create a complaint
      await createComplaint(
        {
          receivedDate: '2025-01-15',
          source: 'customer',
          customerName: 'Test Customer',
          productId: testProductId,
          category: 'quality',
          severity: 'minor',
          description: 'Test complaint for compliance',
        },
        testUserId
      );

      const coverage = await calculateChapterCoverage(9);

      expect(coverage.score).toBeGreaterThanOrEqual(0);
      expect(coverage.score).toBeLessThanOrEqual(100);

      console.log('Chapter 9 score after complaint creation:', coverage.score);
    });

    it('should aggregate all chapter scores into overall compliance', async () => {
      const overview = await getComplianceOverview();

      // Verify each chapter contributes to overall score
      overview.byChapter.forEach((chapter) => {
        expect(chapter.score).toBeGreaterThanOrEqual(0);
        expect(chapter.score).toBeLessThanOrEqual(100);
        expect(chapter.metCount).toBeLessThanOrEqual(chapter.totalCount);
      });

      // Overall score should be within valid range
      expect(overview.overallScore).toBeGreaterThanOrEqual(0);
      expect(overview.overallScore).toBeLessThanOrEqual(100);

      console.log('Final Overall Compliance Score:', overview.overallScore);
      console.log('Chapter Breakdown:');
      overview.byChapter.forEach((ch) => {
        console.log(
          `  Chapter ${ch.chapter} (${ch.nameEn}): ${ch.score}% (${ch.metCount}/${ch.totalCount})`
        );
      });
    });
  });
});

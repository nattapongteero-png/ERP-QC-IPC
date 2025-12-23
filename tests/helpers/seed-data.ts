/**
 * Seed Data Factory
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Provides consistent test data seeding for integration tests.
 * Each module has its own seed function for isolation.
 */

import Database from 'better-sqlite3';
import { TEST_USER_IDS, TEST_DATES, TEST_PRODUCT_IDS } from './test-constants';

/**
 * Seed test users
 * Creates standard test users with different roles
 */
export function seedTestUsers(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
    VALUES
      (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
      (${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, 'Production Supervisor', 'prod@test.com', 'hash123', 'supervisor', 1),
      (${TEST_USER_IDS.QC_ANALYST}, 'QC Analyst', 'qc@test.com', 'hash123', 'analyst', 1),
      (${TEST_USER_IDS.DOCUMENT_CONTROLLER}, 'Document Controller', 'doc@test.com', 'hash123', 'document_controller', 1),
      (${TEST_USER_IDS.AUDITOR}, 'Internal Auditor', 'auditor@test.com', 'hash123', 'auditor', 1)
  `);
}

/**
 * Seed test items (products)
 */
export function seedTestItems(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO items (id, item_code, name_th, name_en, category, unit, is_active)
    VALUES
      (${TEST_PRODUCT_IDS.PRODUCT_A}, 'PROD-001', 'สมุนไพรทดสอบ A', 'Herbal Test A', 'finished_product', 'box', 1),
      (${TEST_PRODUCT_IDS.PRODUCT_B}, 'PROD-002', 'สมุนไพรทดสอบ B', 'Herbal Test B', 'finished_product', 'bottle', 1),
      (${TEST_PRODUCT_IDS.RAW_MATERIAL}, 'RAW-001', 'วัตถุดิบทดสอบ', 'Raw Material Test', 'raw_material', 'kg', 1)
  `);
}

/**
 * Seed test inventory lots
 */
export function seedTestLots(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO inventory_lots (id, lot_number, item_id, quantity, status, expiry_date, manufacture_date)
    VALUES
      (1, 'LOT-2501-0001', ${TEST_PRODUCT_IDS.PRODUCT_A}, 1000, 'released', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.PAST_DATE}'),
      (2, 'LOT-2501-0002', ${TEST_PRODUCT_IDS.PRODUCT_B}, 500, 'released', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.PAST_DATE}'),
      (3, 'LOT-2501-0003', ${TEST_PRODUCT_IDS.RAW_MATERIAL}, 200, 'quarantine', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.PAST_DATE}')
  `);
}

/**
 * Seed test deviations (required for CAPA tests)
 */
export function seedTestDeviations(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO deviations (id, deviation_number, title, description, status, severity)
    VALUES
      (1, 'DEV-2501-0001', 'Temperature excursion in storage area', 'Storage area temperature exceeded 25°C for 2 hours', 'open', 'major'),
      (2, 'DEV-2501-0002', 'Documentation error in batch record', 'Missing signature on weighing verification', 'open', 'minor')
  `);
}

/**
 * Seed test document types
 */
export function seedDocumentTypes(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO document_types (id, code, name, description, retention_years, review_cycle_months)
    VALUES
      (1, 'SOP', 'Standard Operating Procedure', 'Standard procedures for operations', 5, 24),
      (2, 'POL', 'Policy', 'Organizational policies', 10, 36),
      (3, 'FORM', 'Form', 'Operational forms and checklists', 3, 12),
      (4, 'WI', 'Work Instruction', 'Detailed work instructions', 3, 24),
      (5, 'SPEC', 'Specification', 'Product and material specifications', 5, 24)
  `);
}

// ============================================
// Module-Specific Seed Functions
// ============================================

/**
 * Seed data for CAPA module tests
 */
export function seedCapaTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestDeviations(sqlite);
}

/**
 * Seed data for Complaint module tests
 */
export function seedComplaintTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
}

/**
 * Seed data for Document module tests
 */
export function seedDocumentTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedDocumentTypes(sqlite);
}

/**
 * Seed data for Internal Audit module tests
 */
export function seedAuditTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  // Audits may link to CAPA
}

/**
 * Seed data for Recall module tests
 */
export function seedRecallTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
}

/**
 * Seed data for Sanitation module tests
 */
export function seedSanitationTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
}

/**
 * Seed data for Stability module tests
 */
export function seedStabilityTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
}

/**
 * Seed all common test data
 * Use when you need a fully populated test database
 */
export function seedAllTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
  seedTestDeviations(sqlite);
  seedDocumentTypes(sqlite);
}

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
 * Seed stock alert rules with default thresholds
 * FR-049 (expiry alerts), FR-050 (min stock alerts), FR-056 (retest alerts)
 */
export function seedStockAlertRules(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO stock_alert_rules (id, item_id, alert_type, threshold_days, threshold_qty, notify_roles, is_active, created_by, created_at, updated_at)
    VALUES
      -- Global expiry alert: 90 days before expiry (FR-049)
      (1, NULL, 'expiry', 90, NULL, '["qa_manager", "warehouse_manager"]', 1, ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}'),
      -- Global min stock alert (FR-050)
      (2, NULL, 'min_stock', NULL, 100, '["warehouse_manager", "purchasing"]', 1, ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}'),
      -- Global retest alert: 30 days before retest (FR-056)
      (3, NULL, 'retest', 30, NULL, '["qa_manager", "qc_analyst"]', 1, ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}')
  `);
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
  seedStockAlertRules(sqlite);
}

// ============================================
// Extended Seed Functions for UI Testing
// Feature: 014-unit-cost
// ============================================

/**
 * Seed test vendors
 */
export function seedTestVendors(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO vendors (id, code, name, contact_person, phone, email, is_approved, is_vmi, lead_time_days)
    VALUES
      (1, 'V001', 'Vendor Alpha', 'John Doe', '0812345678', 'alpha@vendor.com', 1, 0, 7),
      (2, 'V002', 'Vendor Beta', 'Jane Smith', '0823456789', 'beta@vendor.com', 1, 1, 14),
      (3, 'V003', 'Vendor Gamma', 'Bob Wilson', '0834567890', 'gamma@vendor.com', 0, 0, 21)
  `);
}

/**
 * Seed test customers
 */
export function seedTestCustomers(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO customers (id, code, name, contact_person, phone, email, credit_limit)
    VALUES
      (1, 'C001', 'Customer Alpha', 'Alice Brown', '0811111111', 'alpha@customer.com', 500000),
      (2, 'C002', 'Customer Beta', 'Charlie Davis', '0822222222', 'beta@customer.com', 1000000),
      (3, 'C003', 'Customer Gamma', 'Diana Evans', '0833333333', 'gamma@customer.com', 250000)
  `);
}

/**
 * Seed test purchase orders
 */
export function seedTestPurchaseOrders(sqlite: Database.Database): void {
  const today = TEST_DATES.TODAY;
  const pastDate = TEST_DATES.PAST_DATE;
  sqlite.exec(`
    INSERT OR IGNORE INTO purchase_orders (id, po_number, vendor_id, status, order_date, expected_date, total_amount, currency, created_by)
    VALUES
      (1, 'PO2026-0001', 1, 'draft', '${today}', '${TEST_DATES.FUTURE_DATE}', 50000, 'THB', ${TEST_USER_IDS.QA_MANAGER}),
      (2, 'PO2026-0002', 2, 'approved', '${today}', '${TEST_DATES.FUTURE_DATE}', 75000, 'THB', ${TEST_USER_IDS.QA_MANAGER}),
      (3, 'PO2026-0003', 1, 'received', '${pastDate}', '${today}', 100000, 'THB', ${TEST_USER_IDS.QA_MANAGER}),
      (4, 'PO2026-0004', 3, 'received', '${pastDate}', '${today}', 25000, 'THB', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR})
  `);
}

/**
 * Seed test sales orders
 */
export function seedTestSalesOrders(sqlite: Database.Database): void {
  const today = TEST_DATES.TODAY;
  const pastDate = TEST_DATES.PAST_DATE;
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_orders (id, so_number, customer_id, status, order_date, total_amount, currency, created_by)
    VALUES
      (1, 'SO2026-0001', 1, 'draft', '${today}', 150000, 'THB', ${TEST_USER_IDS.QA_MANAGER}),
      (2, 'SO2026-0002', 2, 'confirmed', '${today}', 250000, 'THB', ${TEST_USER_IDS.QA_MANAGER}),
      (3, 'SO2026-0003', 1, 'shipped', '${pastDate}', 100000, 'THB', ${TEST_USER_IDS.QA_MANAGER})
  `);
}

/**
 * Seed test work orders
 */
export function seedTestWorkOrders(sqlite: Database.Database): void {
  const today = TEST_DATES.TODAY;
  const pastDate = TEST_DATES.PAST_DATE;
  sqlite.exec(`
    INSERT OR IGNORE INTO work_orders (id, wo_number, item_id, quantity, status, planned_start_date, created_by)
    VALUES
      (1, 'WO2026-0001', ${TEST_PRODUCT_IDS.PRODUCT_A}, 100, 'draft', '${today}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}),
      (2, 'WO2026-0002', ${TEST_PRODUCT_IDS.PRODUCT_B}, 50, 'in_progress', '${today}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}),
      (3, 'WO2026-0003', ${TEST_PRODUCT_IDS.PRODUCT_A}, 200, 'completed', '${pastDate}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR})
  `);
}

/**
 * Seed test positions
 */
export function seedTestPositions(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO positions (id, code, name, department, level, is_active)
    VALUES
      (1, 'POS001', 'QA Manager', 'Quality Assurance', 'Manager', 1),
      (2, 'POS002', 'Production Supervisor', 'Production', 'Supervisor', 1),
      (3, 'POS003', 'QC Analyst', 'Quality Control', 'Staff', 1),
      (4, 'POS004', 'Document Controller', 'Quality Assurance', 'Staff', 1),
      (5, 'POS005', 'Internal Auditor', 'Quality Assurance', 'Staff', 1)
  `);
}

/**
 * Seed test training courses
 */
export function seedTestTrainingCourses(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO training_courses (id, code, name, category, duration_hours, is_active)
    VALUES
      (1, 'GMP-101', 'GMP Fundamentals', 'Compliance', 8, 1),
      (2, 'QC-201', 'Quality Control Methods', 'Technical', 16, 1),
      (3, 'SAFE-101', 'Workplace Safety', 'Safety', 4, 1)
  `);
}

// ============================================
// Combined Module Seed Functions
// ============================================

/**
 * Seed data for Purchasing module tests
 */
export function seedPurchasingTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestVendors(sqlite);
  seedTestItems(sqlite);
  seedTestPurchaseOrders(sqlite);
}

/**
 * Seed data for Inventory module tests
 */
export function seedInventoryTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
  seedTestVendors(sqlite);
}

/**
 * Seed data for Sales module tests
 */
export function seedSalesTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestCustomers(sqlite);
  seedTestItems(sqlite);
  seedTestSalesOrders(sqlite);
}

/**
 * Seed data for Production module tests
 */
export function seedProductionTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
  seedTestWorkOrders(sqlite);
}

/**
 * Seed data for HR module tests
 */
export function seedHrTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestPositions(sqlite);
  seedTestTrainingCourses(sqlite);
}

/**
 * Seed comprehensive test data for full integration testing
 */
export function seedComprehensiveTestData(sqlite: Database.Database): void {
  seedAllTestData(sqlite);
  seedTestVendors(sqlite);
  seedTestCustomers(sqlite);
  seedTestPurchaseOrders(sqlite);
  seedTestSalesOrders(sqlite);
  seedTestWorkOrders(sqlite);
  seedTestPositions(sqlite);
  seedTestTrainingCourses(sqlite);
}

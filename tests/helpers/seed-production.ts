/**
 * Seed Data for Production Module
 * Feature: 014-unit-cost
 *
 * Provides test data seeding for production module tests.
 */

import Database from 'better-sqlite3';
import { TEST_USER_IDS, TEST_PRODUCT_IDS, TEST_DATES } from './test-constants';
import { seedTestUsers, seedTestItems, seedTestLots } from './seed-data';

// ============================================
// Production Module Constants
// ============================================

export const TEST_BOM_IDS = {
  PRODUCT_A_V1: 1,
  PRODUCT_B_V1: 2,
  PRODUCT_A_V2_DRAFT: 3,
} as const;

export const TEST_WORK_ORDER_IDS = {
  DRAFT: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
} as const;

export const TEST_BATCH_RECORD_IDS = {
  OPEN: 1,
  CLOSED: 2,
} as const;

// ============================================
// BOM (Bill of Materials) Seeding
// ============================================

/**
 * Seed BOM headers
 */
export function seedBomHeaders(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO bom_headers (id, bom_number, item_id, version, status, effective_date, batch_size, batch_unit, yield_percentage, created_by, created_at, updated_at)
    VALUES
      (${TEST_BOM_IDS.PRODUCT_A_V1}, 'BOM-001', ${TEST_PRODUCT_IDS.PRODUCT_A}, '1.0', 'active', '${TEST_DATES.PAST_DATE}', 100, 'bottle', 98.5, ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}'),
      (${TEST_BOM_IDS.PRODUCT_B_V1}, 'BOM-002', ${TEST_PRODUCT_IDS.PRODUCT_B}, '1.0', 'active', '${TEST_DATES.PAST_DATE}', 50, 'bottle', 97.0, ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}'),
      (${TEST_BOM_IDS.PRODUCT_A_V2_DRAFT}, 'BOM-003', ${TEST_PRODUCT_IDS.PRODUCT_A}, '2.0', 'draft', '${TEST_DATES.FUTURE_DATE}', 100, 'bottle', 99.0, ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}')
  `);
}

/**
 * Seed BOM lines (materials)
 */
export function seedBomLines(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO bom_lines (id, bom_header_id, item_id, quantity, unit, sequence, notes, created_at)
    VALUES
      (1, ${TEST_BOM_IDS.PRODUCT_A_V1}, ${TEST_PRODUCT_IDS.RAW_MATERIAL}, 10, 'kg', 1, 'Raw herb material', '${now}'),
      (2, ${TEST_BOM_IDS.PRODUCT_A_V1}, 4, 100, 'pcs', 2, 'Packaging material', '${now}'),
      (3, ${TEST_BOM_IDS.PRODUCT_B_V1}, ${TEST_PRODUCT_IDS.RAW_MATERIAL}, 5, 'kg', 1, 'Raw herb material', '${now}'),
      (4, ${TEST_BOM_IDS.PRODUCT_B_V1}, 4, 50, 'pcs', 2, 'Packaging material', '${now}')
  `);
}

/**
 * Seed BOM operations (routing)
 */
export function seedBomOperations(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO bom_operations (id, bom_header_id, work_center_id, sequence, operation_name, setup_time, run_time, run_time_unit, created_at)
    VALUES
      (1, ${TEST_BOM_IDS.PRODUCT_A_V1}, 1, 10, 'Mixing', 30, 60, 'minutes', '${now}'),
      (2, ${TEST_BOM_IDS.PRODUCT_A_V1}, 2, 20, 'Filling', 45, 90, 'minutes', '${now}'),
      (3, ${TEST_BOM_IDS.PRODUCT_A_V1}, 3, 30, 'Packaging', 15, 45, 'minutes', '${now}'),
      (4, ${TEST_BOM_IDS.PRODUCT_B_V1}, 1, 10, 'Mixing', 30, 45, 'minutes', '${now}'),
      (5, ${TEST_BOM_IDS.PRODUCT_B_V1}, 2, 20, 'Filling', 45, 60, 'minutes', '${now}')
  `);
}

// ============================================
// Work Order Seeding
// ============================================

/**
 * Seed work order headers
 */
export function seedWorkOrderHeaders(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO work_orders (id, wo_number, item_id, bom_id, quantity, unit, status, priority, planned_start_date, planned_end_date, actual_start_date, actual_end_date, created_by, created_at, updated_at)
    VALUES
      (${TEST_WORK_ORDER_IDS.DRAFT}, 'WO2026-0001', ${TEST_PRODUCT_IDS.PRODUCT_A}, ${TEST_BOM_IDS.PRODUCT_A_V1}, 100, 'bottle', 'draft', 'medium', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.FUTURE_DATE}', NULL, NULL, ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}'),
      (${TEST_WORK_ORDER_IDS.IN_PROGRESS}, 'WO2026-0002', ${TEST_PRODUCT_IDS.PRODUCT_B}, ${TEST_BOM_IDS.PRODUCT_B_V1}, 50, 'bottle', 'in_progress', 'high', '${TEST_DATES.TODAY}', '${TEST_DATES.NEAR_FUTURE}', '${TEST_DATES.TODAY}', NULL, ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}'),
      (${TEST_WORK_ORDER_IDS.COMPLETED}, 'WO2026-0003', ${TEST_PRODUCT_IDS.PRODUCT_A}, ${TEST_BOM_IDS.PRODUCT_A_V1}, 200, 'bottle', 'completed', 'low', '${TEST_DATES.PAST_DATE}', '${TEST_DATES.PAST_DATE}', '${TEST_DATES.PAST_DATE}', '${TEST_DATES.PAST_DATE}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}')
  `);
}

/**
 * Seed work order materials (material requisition)
 */
export function seedWorkOrderMaterials(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO work_order_materials (id, work_order_id, item_id, lot_id, required_quantity, issued_quantity, unit, status, created_at)
    VALUES
      (1, ${TEST_WORK_ORDER_IDS.IN_PROGRESS}, ${TEST_PRODUCT_IDS.RAW_MATERIAL}, 3, 5, 5, 'kg', 'issued', '${now}'),
      (2, ${TEST_WORK_ORDER_IDS.IN_PROGRESS}, 4, NULL, 50, 50, 'pcs', 'issued', '${now}'),
      (3, ${TEST_WORK_ORDER_IDS.COMPLETED}, ${TEST_PRODUCT_IDS.RAW_MATERIAL}, 3, 20, 20, 'kg', 'issued', '${now}'),
      (4, ${TEST_WORK_ORDER_IDS.COMPLETED}, 4, NULL, 200, 200, 'pcs', 'issued', '${now}')
  `);
}

// ============================================
// Batch Record Seeding
// ============================================

/**
 * Seed batch records
 */
export function seedBatchRecords(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO batch_records (id, batch_number, work_order_id, item_id, quantity, unit, status, production_date, expiry_date, created_by, created_at, updated_at)
    VALUES
      (${TEST_BATCH_RECORD_IDS.OPEN}, 'BR2026-0001', ${TEST_WORK_ORDER_IDS.IN_PROGRESS}, ${TEST_PRODUCT_IDS.PRODUCT_B}, 50, 'bottle', 'open', '${TEST_DATES.TODAY}', '${TEST_DATES.FUTURE_DATE}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}'),
      (${TEST_BATCH_RECORD_IDS.CLOSED}, 'BR2026-0002', ${TEST_WORK_ORDER_IDS.COMPLETED}, ${TEST_PRODUCT_IDS.PRODUCT_A}, 200, 'bottle', 'closed', '${TEST_DATES.PAST_DATE}', '${TEST_DATES.FUTURE_DATE}', ${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, '${now}', '${now}')
  `);
}

// ============================================
// Combined Seed Functions
// ============================================

/**
 * Seed all BOM test data
 */
export function seedBomTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedBomHeaders(sqlite);
  seedBomLines(sqlite);
}

/**
 * Seed all BOM test data with operations
 */
export function seedBomFullTestData(sqlite: Database.Database): void {
  seedBomTestData(sqlite);
  seedBomOperations(sqlite);
}

/**
 * Seed all work order test data
 */
export function seedWorkOrderTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestItems(sqlite);
  seedTestLots(sqlite);
  seedBomHeaders(sqlite);
  seedWorkOrderHeaders(sqlite);
}

/**
 * Seed all work order test data with materials
 */
export function seedWorkOrderFullTestData(sqlite: Database.Database): void {
  seedWorkOrderTestData(sqlite);
  seedWorkOrderMaterials(sqlite);
}

/**
 * Seed all batch record test data
 */
export function seedBatchRecordTestData(sqlite: Database.Database): void {
  seedWorkOrderFullTestData(sqlite);
  seedBatchRecords(sqlite);
}

/**
 * Seed all production module test data
 */
export function seedProductionModuleTestData(sqlite: Database.Database): void {
  seedBomFullTestData(sqlite);
  seedWorkOrderFullTestData(sqlite);
  seedBatchRecords(sqlite);
}

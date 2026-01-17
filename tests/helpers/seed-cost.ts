/**
 * Seed Data for Cost Module
 * Feature: 014-unit-cost
 *
 * Provides test data seeding for cost management module tests.
 */

import Database from 'better-sqlite3';
import { TEST_USER_IDS, TEST_DATES } from './test-constants';
import { seedTestUsers, seedTestVendors, seedTestItems, seedTestPurchaseOrders } from './seed-data';

// ============================================
// Cost Module Constants
// ============================================

export const TEST_LANDED_COST_IDS = {
  DRAFT: 1,
  ALLOCATED: 2,
  POSTED: 3,
} as const;

export const TEST_WORK_CENTER_IDS = {
  MIXING: 1,
  FILLING: 2,
  PACKAGING: 3,
} as const;

// ============================================
// Landed Cost Seeding
// ============================================

/**
 * Seed landed cost headers
 */
export function seedLandedCostHeaders(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO landed_cost_headers (id, document_number, reference_type, reference_id, reference_number, vendor_id, invoice_number, invoice_date, total_amount, currency, exchange_rate, status, created_by, created_at, updated_at)
    VALUES
      (${TEST_LANDED_COST_IDS.DRAFT}, 'LC2026-00001', 'po', 3, 'PO2026-0003', 1, 'INV-001', '${TEST_DATES.TODAY}', 5000, 'THB', 1, 'draft', ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}'),
      (${TEST_LANDED_COST_IDS.ALLOCATED}, 'LC2026-00002', 'po', 4, 'PO2026-0004', 3, 'INV-002', '${TEST_DATES.TODAY}', 3000, 'THB', 1, 'allocated', ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}'),
      (${TEST_LANDED_COST_IDS.POSTED}, 'LC2026-00003', 'po', 3, 'PO2026-0003', 1, 'INV-003', '${TEST_DATES.PAST_DATE}', 7500, 'THB', 1, 'posted', ${TEST_USER_IDS.QA_MANAGER}, '${now}', '${now}')
  `);
}

/**
 * Seed landed cost lines
 */
export function seedLandedCostLines(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO landed_cost_lines (id, landed_cost_header_id, cost_type, description, amount, allocation_basis, created_at)
    VALUES
      (1, ${TEST_LANDED_COST_IDS.DRAFT}, 'freight', 'Sea freight from China', 3000, 'value', '${now}'),
      (2, ${TEST_LANDED_COST_IDS.DRAFT}, 'duty', 'Import duty', 2000, 'value', '${now}'),
      (3, ${TEST_LANDED_COST_IDS.ALLOCATED}, 'freight', 'Air freight', 2500, 'quantity', '${now}'),
      (4, ${TEST_LANDED_COST_IDS.ALLOCATED}, 'insurance', 'Cargo insurance', 500, 'value', '${now}'),
      (5, ${TEST_LANDED_COST_IDS.POSTED}, 'freight', 'Express delivery', 5000, 'weight', '${now}'),
      (6, ${TEST_LANDED_COST_IDS.POSTED}, 'handling', 'Port handling', 2500, 'volume', '${now}')
  `);
}

/**
 * Seed landed cost allocations (for allocated/posted records)
 */
export function seedLandedCostAllocations(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO landed_cost_allocations (id, landed_cost_line_id, landed_cost_header_id, item_id, lot_id, po_line_id, allocated_amount, basis_value, created_at)
    VALUES
      (1, 3, ${TEST_LANDED_COST_IDS.ALLOCATED}, 1, NULL, 1, 1500.00, 500, '${now}'),
      (2, 3, ${TEST_LANDED_COST_IDS.ALLOCATED}, 2, NULL, 2, 1000.00, 300, '${now}'),
      (3, 4, ${TEST_LANDED_COST_IDS.ALLOCATED}, 1, NULL, 1, 300.00, 500, '${now}'),
      (4, 4, ${TEST_LANDED_COST_IDS.ALLOCATED}, 2, NULL, 2, 200.00, 300, '${now}')
  `);
}

// ============================================
// Work Center Seeding
// ============================================

/**
 * Seed work centers
 */
export function seedWorkCenters(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO work_centers (id, code, name, department, hourly_rate, setup_time_minutes, is_active, created_at, updated_at)
    VALUES
      (${TEST_WORK_CENTER_IDS.MIXING}, 'WC001', 'Mixing Station 1', 'Production', 500, 30, 1, '${now}', '${now}'),
      (${TEST_WORK_CENTER_IDS.FILLING}, 'WC002', 'Filling Line A', 'Production', 750, 45, 1, '${now}', '${now}'),
      (${TEST_WORK_CENTER_IDS.PACKAGING}, 'WC003', 'Packaging Station', 'Packaging', 400, 15, 1, '${now}', '${now}')
  `);
}

/**
 * Seed work center cost rates (historical rates for cost calculation)
 */
export function seedWorkCenterCostRates(sqlite: Database.Database): void {
  const now = new Date().toISOString();
  sqlite.exec(`
    INSERT OR IGNORE INTO work_center_cost_rates (id, work_center_id, effective_date, hourly_rate, overhead_rate, created_at)
    VALUES
      (1, ${TEST_WORK_CENTER_IDS.MIXING}, '${TEST_DATES.PAST_DATE}', 500, 100, '${now}'),
      (2, ${TEST_WORK_CENTER_IDS.FILLING}, '${TEST_DATES.PAST_DATE}', 750, 150, '${now}'),
      (3, ${TEST_WORK_CENTER_IDS.PACKAGING}, '${TEST_DATES.PAST_DATE}', 400, 80, '${now}')
  `);
}

// ============================================
// Combined Seed Functions
// ============================================

/**
 * Seed all landed cost test data
 */
export function seedLandedCostTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedTestVendors(sqlite);
  seedTestItems(sqlite);
  seedTestPurchaseOrders(sqlite);
  seedLandedCostHeaders(sqlite);
  seedLandedCostLines(sqlite);
}

/**
 * Seed all landed cost test data including allocations
 */
export function seedLandedCostFullTestData(sqlite: Database.Database): void {
  seedLandedCostTestData(sqlite);
  seedLandedCostAllocations(sqlite);
}

/**
 * Seed all work center test data
 */
export function seedWorkCenterTestData(sqlite: Database.Database): void {
  seedTestUsers(sqlite);
  seedWorkCenters(sqlite);
  seedWorkCenterCostRates(sqlite);
}

/**
 * Seed all cost module test data
 */
export function seedCostModuleTestData(sqlite: Database.Database): void {
  seedLandedCostFullTestData(sqlite);
  seedWorkCenters(sqlite);
  seedWorkCenterCostRates(sqlite);
}

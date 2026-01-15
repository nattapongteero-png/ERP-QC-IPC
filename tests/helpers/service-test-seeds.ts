/**
 * Service Test Seed Data
 * Feature: 014-unit-cost
 *
 * Pre-built seed data factories for service integration tests.
 * These create realistic test data for various domain scenarios.
 */

import Database from 'better-sqlite3';
import { getSqliteDate, getSqliteDateOffset, generateTestId } from './service-test-utils';

/**
 * Seed test user
 */
export function seedTestUser(sqlite: Database.Database, userId = 1): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, email, name, role, password, is_active, created_at, updated_at)
    VALUES (${userId}, 'test${userId}@example.com', 'Test User ${userId}', 'admin', 'hash', 1, '${getSqliteDate()}', '${getSqliteDate()}')
  `);
}

/**
 * Seed items with various types
 */
export function seedItemsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  const items = [
    // Raw materials
    { code: 'RAW001', name: 'Ginger Extract', type: 'raw_material', unit: 'kg', onHand: 100, cost: 5000 },
    { code: 'RAW002', name: 'Turmeric Powder', type: 'raw_material', unit: 'kg', onHand: 50, cost: 3000 },
    { code: 'RAW003', name: 'Honey', type: 'raw_material', unit: 'kg', onHand: 200, cost: 8000 },
    // Packaging
    { code: 'PKG001', name: 'Bottle 100ml', type: 'packaging', unit: 'pcs', onHand: 1000, cost: 5000 },
    { code: 'PKG002', name: 'Cap', type: 'packaging', unit: 'pcs', onHand: 1000, cost: 1000 },
    { code: 'PKG003', name: 'Label', type: 'packaging', unit: 'pcs', onHand: 2000, cost: 2000 },
    // Finished goods
    { code: 'FG001', name: 'Herbal Syrup 100ml', type: 'finished_goods', unit: 'bottle', onHand: 500, cost: 25000 },
    { code: 'FG002', name: 'Turmeric Capsules', type: 'finished_goods', unit: 'box', onHand: 300, cost: 15000 },
    // WIP
    { code: 'WIP001', name: 'Syrup Base', type: 'wip', unit: 'kg', onHand: 50, cost: 7500 },
  ];

  for (const item of items) {
    sqlite.exec(`
      INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost, created_at, updated_at)
      VALUES ('${item.code}', '${item.name}', '${item.type}', '${item.unit}', 1, ${item.onHand}, ${item.cost}, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed vendors with various statuses
 */
export function seedVendorsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  const vendors = [
    { code: 'V001', name: 'Herb Supplier Co.', type: 'raw_material', status: 'approved', credit: 500000 },
    { code: 'V002', name: 'Package Solutions', type: 'packaging', status: 'approved', credit: 300000 },
    { code: 'V003', name: 'Chemical Corp', type: 'raw_material', status: 'pending', credit: 200000 },
    { code: 'V004', name: 'Old Supplier', type: 'raw_material', status: 'inactive', credit: 0 },
  ];

  for (const vendor of vendors) {
    sqlite.exec(`
      INSERT INTO vendors (code, name, vendor_type, status, credit_limit, created_at, updated_at)
      VALUES ('${vendor.code}', '${vendor.name}', '${vendor.type}', '${vendor.status}', ${vendor.credit}, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed customers with credit limits
 */
export function seedCustomersData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  const customers = [
    { code: 'C001', name: 'Hospital A', type: 'hospital', credit: 1000000, terms: 30 },
    { code: 'C002', name: 'Pharmacy Chain B', type: 'pharmacy', credit: 500000, terms: 15 },
    { code: 'C003', name: 'Distributor C', type: 'distributor', credit: 2000000, terms: 45 },
    { code: 'C004', name: 'Retail Shop D', type: 'retail', credit: 100000, terms: 7 },
  ];

  for (const customer of customers) {
    sqlite.exec(`
      INSERT INTO customers (code, name, customer_type, credit_limit, credit_term_days, is_active, created_at, updated_at)
      VALUES ('${customer.code}', '${customer.name}', '${customer.type}', ${customer.credit}, ${customer.terms}, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed purchase orders in various states
 */
export function seedPurchaseOrdersData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedVendorsData(sqlite);
  seedItemsData(sqlite);

  const orders = [
    { number: 'PO-2024-001', vendorId: 1, status: 'draft', total: 50000 },
    { number: 'PO-2024-002', vendorId: 1, status: 'approved', total: 75000 },
    { number: 'PO-2024-003', vendorId: 2, status: 'received', total: 30000 },
    { number: 'PO-2024-004', vendorId: 1, status: 'cancelled', total: 25000 },
  ];

  for (const order of orders) {
    sqlite.exec(`
      INSERT INTO purchase_orders (po_number, vendor_id, status, total_amount, order_date, created_by, created_at, updated_at)
      VALUES ('${order.number}', ${order.vendorId}, '${order.status}', ${order.total}, '${getSqliteDate()}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed work orders with BOM
 */
export function seedWorkOrdersData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedItemsData(sqlite);

  // Create a BOM first
  sqlite.exec(`
    INSERT INTO bom (item_id, version, status, batch_size, batch_unit, is_active, created_by, created_at, updated_at)
    VALUES (7, '1.0', 'approved', 100, 'bottle', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
  `);

  // Add BOM lines
  sqlite.exec(`
    INSERT INTO bom_lines (bom_id, line_number, item_id, quantity, unit, is_critical, created_at, updated_at)
    VALUES
      (1, 1, 1, 5, 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
      (1, 2, 3, 10, 'kg', 0, '${getSqliteDate()}', '${getSqliteDate()}'),
      (1, 3, 4, 100, 'pcs', 0, '${getSqliteDate()}', '${getSqliteDate()}')
  `);

  // Create work orders
  const workOrders = [
    { number: 'WO-2024-001', bomId: 1, status: 'draft', quantity: 100 },
    { number: 'WO-2024-002', bomId: 1, status: 'in_progress', quantity: 200 },
    { number: 'WO-2024-003', bomId: 1, status: 'completed', quantity: 150 },
  ];

  for (const wo of workOrders) {
    sqlite.exec(`
      INSERT INTO work_orders (wo_number, bom_id, item_id, status, planned_quantity, planned_unit, planned_start_date, created_by, created_at, updated_at)
      VALUES ('${wo.number}', ${wo.bomId}, 7, '${wo.status}', ${wo.quantity}, 'bottle', '${getSqliteDate()}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed CAPA records for GMP testing
 */
export function seedCapaData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  const capas = [
    { id: 1, number: 'CAPA-2024-001', type: 'corrective', status: 'open', priority: 'high' },
    { id: 2, number: 'CAPA-2024-002', type: 'preventive', status: 'investigation', priority: 'medium' },
    { id: 3, number: 'CAPA-2024-003', type: 'corrective', status: 'closed', priority: 'low' },
  ];

  for (const capa of capas) {
    sqlite.exec(`
      INSERT INTO capa (id, capa_number, type, status, priority, title, source_type, owner_id, created_by, created_at, updated_at)
      VALUES (${capa.id}, '${capa.number}', '${capa.type}', '${capa.status}', '${capa.priority}', 'Test CAPA', 'deviation', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  // Add actions to first CAPA
  sqlite.exec(`
    INSERT INTO capa_actions (capa_id, action_number, description, action_type, assignee_id, due_date, status, created_at)
    VALUES
      (1, 1, 'Investigate root cause', 'corrective', 1, '${getSqliteDateOffset(7)}', 'pending', '${getSqliteDate()}'),
      (1, 2, 'Implement fix', 'corrective', 1, '${getSqliteDateOffset(14)}', 'pending', '${getSqliteDate()}')
  `);
}

/**
 * Seed complaints for GMP testing
 */
export function seedComplaintsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedItemsData(sqlite);

  const complaints = [
    { id: 1, number: 'COMP-2024-0001', status: 'received', source: 'customer', category: 'quality', severity: 'minor' },
    { id: 2, number: 'COMP-2024-0002', status: 'under_investigation', source: 'distributor', category: 'packaging', severity: 'major' },
    { id: 3, number: 'COMP-2024-0003', status: 'closed', source: 'internal', category: 'labeling', severity: 'minor' },
  ];

  for (const complaint of complaints) {
    sqlite.exec(`
      INSERT INTO complaints (id, complaint_number, status, source, category, severity, description, product_id, received_date, created_by, created_at, updated_at)
      VALUES (${complaint.id}, '${complaint.number}', '${complaint.status}', '${complaint.source}', '${complaint.category}', '${complaint.severity}', 'Test complaint', 1, '${getSqliteDate()}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed audit records
 */
export function seedAuditsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  const audits = [
    { number: 'AUD-2024-001', type: 'internal', status: 'planned', scope: 'Production' },
    { number: 'AUD-2024-002', type: 'internal', status: 'in_progress', scope: 'Quality' },
    { number: 'AUD-2024-003', type: 'external', status: 'completed', scope: 'GMP' },
  ];

  for (const audit of audits) {
    sqlite.exec(`
      INSERT INTO audits (audit_number, audit_type, status, scope, planned_start_date, planned_end_date, lead_auditor_id, created_by, created_at, updated_at)
      VALUES ('${audit.number}', '${audit.type}', '${audit.status}', '${audit.scope}', '${getSqliteDate()}', '${getSqliteDateOffset(7)}', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed GL accounts for accounting tests
 */
export function seedGLAccountsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  // Account types
  sqlite.exec(`
    INSERT INTO gl_account_types (code, name, category, is_active, created_at, updated_at)
    VALUES
      ('ASSET', 'Assets', 'asset', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
      ('LIABILITY', 'Liabilities', 'liability', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
      ('EQUITY', 'Equity', 'equity', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
      ('REVENUE', 'Revenue', 'revenue', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
      ('EXPENSE', 'Expenses', 'expense', 1, '${getSqliteDate()}', '${getSqliteDate()}')
  `);

  // GL accounts
  const accounts = [
    { code: '1100', name: 'Cash', typeId: 1, normal: 'debit' },
    { code: '1200', name: 'Accounts Receivable', typeId: 1, normal: 'debit' },
    { code: '1300', name: 'Inventory', typeId: 1, normal: 'debit' },
    { code: '2100', name: 'Accounts Payable', typeId: 2, normal: 'credit' },
    { code: '3100', name: 'Retained Earnings', typeId: 3, normal: 'credit' },
    { code: '4100', name: 'Sales Revenue', typeId: 4, normal: 'credit' },
    { code: '5100', name: 'Cost of Goods Sold', typeId: 5, normal: 'debit' },
  ];

  for (const account of accounts) {
    sqlite.exec(`
      INSERT INTO gl_accounts (code, name, account_type_id, normal_balance, is_active, created_at, updated_at)
      VALUES ('${account.code}', '${account.name}', ${account.typeId}, '${account.normal}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed fiscal periods
 */
export function seedFiscalPeriodsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);

  // Fiscal year
  sqlite.exec(`
    INSERT INTO fiscal_years (code, name, start_date, end_date, status, is_current, created_at, updated_at)
    VALUES ('FY2024', 'Fiscal Year 2024', '2024-01-01', '2024-12-31', 'open', 1, '${getSqliteDate()}', '${getSqliteDate()}')
  `);

  // Fiscal periods (months)
  for (let i = 1; i <= 12; i++) {
    const month = String(i).padStart(2, '0');
    const startDate = `2024-${month}-01`;
    const endDate = i === 12 ? '2024-12-31' : `2024-${String(i + 1).padStart(2, '0')}-01`;
    const status = i <= 6 ? 'closed' : 'open';

    sqlite.exec(`
      INSERT INTO fiscal_periods (fiscal_year_id, period_number, name, start_date, end_date, status, created_at, updated_at)
      VALUES (1, ${i}, 'Period ${i}', '${startDate}', '${endDate}', '${status}', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed sales orders
 */
export function seedSalesOrdersData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedCustomersData(sqlite);
  seedItemsData(sqlite);

  const orders = [
    { number: 'SO-2024-001', customerId: 1, status: 'draft', total: 100000 },
    { number: 'SO-2024-002', customerId: 2, status: 'confirmed', total: 75000 },
    { number: 'SO-2024-003', customerId: 1, status: 'delivered', total: 50000 },
  ];

  for (const order of orders) {
    sqlite.exec(`
      INSERT INTO sales_orders (so_number, customer_id, status, total_amount, order_date, created_by, created_at, updated_at)
      VALUES ('${order.number}', ${order.customerId}, '${order.status}', ${order.total}, '${getSqliteDate()}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Seed inventory lots
 */
export function seedInventoryLotsData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedItemsData(sqlite);

  // Create a warehouse first
  sqlite.exec(`
    INSERT INTO warehouses (code, name, is_active, created_at, updated_at)
    VALUES ('WH01', 'Main Warehouse', 1, '${getSqliteDate()}', '${getSqliteDate()}')
  `);

  const lots = [
    { itemId: 1, lotNumber: 'LOT-001', qty: 50, status: 'released', expiry: getSqliteDateOffset(180) },
    { itemId: 1, lotNumber: 'LOT-002', qty: 50, status: 'quarantine', expiry: getSqliteDateOffset(180) },
    { itemId: 2, lotNumber: 'LOT-003', qty: 25, status: 'released', expiry: getSqliteDateOffset(90) },
    { itemId: 7, lotNumber: 'LOT-004', qty: 200, status: 'released', expiry: getSqliteDateOffset(365) },
  ];

  for (const lot of lots) {
    sqlite.exec(`
      INSERT INTO inventory_lots (item_id, lot_number, quantity, status, warehouse_id, expiry_date, received_date, created_at, updated_at)
      VALUES (${lot.itemId}, '${lot.lotNumber}', ${lot.qty}, '${lot.status}', 1, '${lot.expiry}', '${getSqliteDate()}', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }
}

/**
 * Combined seed for comprehensive testing
 */
export function seedAllTestData(sqlite: Database.Database): void {
  seedTestUser(sqlite);
  seedItemsData(sqlite);
  seedVendorsData(sqlite);
  seedCustomersData(sqlite);
  seedInventoryLotsData(sqlite);
  seedPurchaseOrdersData(sqlite);
  seedSalesOrdersData(sqlite);
  seedWorkOrdersData(sqlite);
  seedCapaData(sqlite);
  seedComplaintsData(sqlite);
  seedAuditsData(sqlite);
  seedGLAccountsData(sqlite);
  seedFiscalPeriodsData(sqlite);
}

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { mysqlTable, varchar, int, decimal, datetime, boolean as mysqlBoolean, text as mysqlText } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ============================================
// SQLite Schema (for unit testing)
// ============================================

// Users table
export const sqliteUsers = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('user'), // admin, manager, user, qc, production
  department: text('department'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Audit Trail
export const sqliteAuditTrail = sqliteTable('audit_trail', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => sqliteUsers.id),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT
  tableName: text('table_name'),
  recordId: integer('record_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Item Categories (หมวดหมู่สินค้า)
export const sqliteItemCategories = sqliteTable('item_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Item Units (หน่วยวัดสินค้า)
export const sqliteItemUnits = sqliteTable('item_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  symbol: text('symbol'), // e.g., kg, g, L, pcs
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Item Master (วัตถุดิบ/สินค้า)
export const sqliteItems = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  type: text('type').notNull(), // raw_material, extract, solvent, excipient, packaging, finished_product
  category: text('category'),
  primaryUnit: text('primary_unit').notNull(),
  secondaryUnit: text('secondary_unit'),
  conversionRate: real('conversion_rate'),
  shelfLifeDays: integer('shelf_life_days'),
  storageCondition: text('storage_condition'),
  minStock: real('min_stock').default(0),
  maxStock: real('max_stock'),
  reorderPoint: real('reorder_point'),
  onHand: real('on_hand').notNull().default(0), // Cached on-hand quantity from released lots
  onHandCost: real('on_hand_cost').notNull().default(0), // Cached total cost of on-hand inventory
  isLotControlled: integer('is_lot_controlled', { mode: 'boolean' }).notNull().default(true),
  isFEFO: integer('is_fefo', { mode: 'boolean' }).notNull().default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // VMI Standard Codes - items need EITHER tppCode OR ttmtCode for VMI sync
  tppCode: text('tpp_code'), // Thai Pharmaceutical Product code (13 digits)
  tppName: text('tpp_name'), // TPP product name from VMI Portal
  ttmtCode: text('ttmt_code'), // Thai Traditional Medicine Terminology (A + 8 digits)
  ttmtName: text('ttmt_name'), // TTMT product name (FSN) from VMI Portal
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiSyncEnabled: integer('vmi_sync_enabled', { mode: 'boolean' }).notNull().default(false),
  lastVmiSyncAt: text('last_vmi_sync_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Herbal Attributes (คุณลักษณะเฉพาะสมุนไพร)
export const sqliteHerbalAttributes = sqliteTable('herbal_attributes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  botanicalName: text('botanical_name'), // ชื่อพฤกษศาสตร์
  partUsed: text('part_used'), // ใบ/ราก/เปลือก
  originCountry: text('origin_country'),
  originProvince: text('origin_province'),
  harvestDate: text('harvest_date'),
  dryingMethod: text('drying_method'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Vendors (ผู้ขาย)
export const sqliteVendors = sqliteTable('vendors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxId: text('tax_id'),
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
  isVMI: integer('is_vmi', { mode: 'boolean' }).notNull().default(false),
  leadTimeDays: integer('lead_time_days'),
  paymentTerms: text('payment_terms'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Approved Vendor List (AVL)
export const sqliteApprovedVendorList = sqliteTable('approved_vendor_list', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id),
  approvalDate: text('approval_date'),
  expiryDate: text('expiry_date'),
  isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Warehouses (คลังสินค้า)
export const sqliteWarehouses = sqliteTable('warehouses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(), // raw_material, finished_goods, quarantine, rejected
  location: text('location'),
  temperatureMin: real('temperature_min'),
  temperatureMax: real('temperature_max'),
  humidityMin: real('humidity_min'),
  humidityMax: real('humidity_max'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Warehouse Locations/Bins
export const sqliteWarehouseLocations = sqliteTable('warehouse_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  warehouseId: integer('warehouse_id').notNull().references(() => sqliteWarehouses.id),
  code: text('code').notNull(),
  name: text('name'),
  zone: text('zone'),
  rack: text('rack'),
  shelf: text('shelf'),
  bin: text('bin'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Inventory Lots
export const sqliteInventoryLots = sqliteTable('inventory_lots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  lotNumber: text('lot_number').notNull(),
  batchNumber: text('batch_number'),
  warehouseId: integer('warehouse_id').notNull().references(() => sqliteWarehouses.id),
  locationId: integer('location_id').references(() => sqliteWarehouseLocations.id),
  quantity: real('quantity').notNull().default(0),
  reservedQuantity: real('reserved_quantity').notNull().default(0),
  unit: text('unit').notNull(),
  status: text('status').notNull().default('quarantine'), // quarantine, under_test, released, rejected, blocked
  manufacturingDate: text('manufacturing_date'),
  expiryDate: text('expiry_date'),
  receivedDate: text('received_date'),
  vendorId: integer('vendor_id').references(() => sqliteVendors.id),
  poNumber: text('po_number'),
  coaNumber: text('coa_number'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Inventory Transactions
export const sqliteInventoryTransactions = sqliteTable('inventory_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lotId: integer('lot_id').notNull().references(() => sqliteInventoryLots.id),
  transactionType: text('transaction_type').notNull(), // receive, issue, return, adjust, transfer, scrap
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  referenceType: text('reference_type'), // PO, WO, SO, ADJUST
  referenceId: integer('reference_id'),
  referenceNumber: text('reference_number'),
  fromWarehouseId: integer('from_warehouse_id').references(() => sqliteWarehouses.id),
  toWarehouseId: integer('to_warehouse_id').references(() => sqliteWarehouses.id),
  reason: text('reason'),
  performedBy: integer('performed_by').references(() => sqliteUsers.id),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Bill of Materials (BOM) / Recipe
export const sqliteBOM = sqliteTable('bom', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  productId: integer('product_id').notNull().references(() => sqliteItems.id),
  version: text('version').notNull().default('1.0'),
  status: text('status').notNull().default('draft'), // draft, approved, obsolete
  batchSize: real('batch_size').notNull(),
  batchUnit: text('batch_unit').notNull(),
  yieldTarget: real('yield_target'), // percentage
  lossAllowance: real('loss_allowance'), // percentage
  effectiveDate: text('effective_date'),
  expiryDate: text('expiry_date'),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// BOM Lines
export const sqliteBOMLines = sqliteTable('bom_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bomId: integer('bom_id').notNull().references(() => sqliteBOM.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  sequence: integer('sequence').notNull().default(1),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Production Operations/Routing
export const sqliteOperations = sqliteTable('operations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bomId: integer('bom_id').notNull().references(() => sqliteBOM.id),
  sequence: integer('sequence').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  workCenterId: integer('work_center_id'),
  standardTime: real('standard_time'), // minutes
  setupTime: real('setup_time'), // minutes
  cleaningTime: real('cleaning_time'), // minutes
  instructions: text('instructions'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Work Orders (ใบสั่งผลิต)
export const sqliteWorkOrders = sqliteTable('work_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  woNumber: text('wo_number').notNull().unique(),
  bomId: integer('bom_id').notNull().references(() => sqliteBOM.id),
  productId: integer('product_id').notNull().references(() => sqliteItems.id),
  batchNumber: text('batch_number').notNull(),
  plannedQuantity: real('planned_quantity').notNull(),
  actualQuantity: real('actual_quantity'),
  unit: text('unit').notNull(),
  status: text('status').notNull().default('planned'), // planned, released, in_progress, completed, cancelled
  priority: integer('priority').notNull().default(5),
  plannedStartDate: text('planned_start_date'),
  plannedEndDate: text('planned_end_date'),
  actualStartDate: text('actual_start_date'),
  actualEndDate: text('actual_end_date'),
  yieldPercentage: real('yield_percentage'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Work Order Materials (วัตถุดิบที่ใช้ในใบสั่งผลิต)
export const sqliteWorkOrderMaterials = sqliteTable('work_order_materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id').notNull().references(() => sqliteWorkOrders.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  lotId: integer('lot_id').references(() => sqliteInventoryLots.id),
  plannedQuantity: real('planned_quantity').notNull(),
  actualQuantity: real('actual_quantity'),
  unit: text('unit').notNull(),
  status: text('status').notNull().default('pending'), // pending, issued, returned
  issuedBy: integer('issued_by').references(() => sqliteUsers.id),
  issuedAt: text('issued_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Batch Records (eBMR)
export const sqliteBatchRecords = sqliteTable('batch_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id').notNull().references(() => sqliteWorkOrders.id),
  operationId: integer('operation_id').notNull().references(() => sqliteOperations.id),
  sequence: integer('sequence').notNull(),
  stepName: text('step_name').notNull(),
  instructions: text('instructions'),
  parameters: text('parameters'), // JSON string
  actualValues: text('actual_values'), // JSON string
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, deviation
  startTime: text('start_time'),
  endTime: text('end_time'),
  performedBy: integer('performed_by').references(() => sqliteUsers.id),
  verifiedBy: integer('verified_by').references(() => sqliteUsers.id),
  verifiedAt: text('verified_at'),
  notes: text('notes'),
  attachments: text('attachments'), // JSON array of file paths
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Quality Specifications
export const sqliteQualitySpecs = sqliteTable('quality_specs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  testName: text('test_name').notNull(),
  testMethod: text('test_method'),
  specification: text('specification'),
  minValue: real('min_value'),
  maxValue: real('max_value'),
  unit: text('unit'),
  isCritical: integer('is_critical', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Quality Tests
export const sqliteQualityTests = sqliteTable('quality_tests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lotId: integer('lot_id').notNull().references(() => sqliteInventoryLots.id),
  specId: integer('spec_id').notNull().references(() => sqliteQualitySpecs.id),
  testType: text('test_type').notNull(), // incoming, in_process, final
  sampleNumber: text('sample_number'),
  testDate: text('test_date'),
  result: text('result'),
  numericResult: real('numeric_result'),
  status: text('status').notNull().default('pending'), // pending, pass, fail, retest
  testedBy: integer('tested_by').references(() => sqliteUsers.id),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  approvedAt: text('approved_at'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Deviations
export const sqliteDeviations = sqliteTable('deviations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deviationNumber: text('deviation_number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  sourceType: text('source_type'), // production, quality, warehouse
  sourceId: integer('source_id'),
  severity: text('severity').notNull().default('minor'), // minor, major, critical
  status: text('status').notNull().default('open'), // open, investigating, resolved, closed
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  preventiveAction: text('preventive_action'),
  reportedBy: integer('reported_by').references(() => sqliteUsers.id),
  assignedTo: integer('assigned_to').references(() => sqliteUsers.id),
  dueDate: text('due_date'),
  closedBy: integer('closed_by').references(() => sqliteUsers.id),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Purchase Orders
export const sqlitePurchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  poNumber: text('po_number').notNull().unique(),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id),
  status: text('status').notNull().default('draft'), // draft, approved, sent, partial, received, cancelled
  orderDate: text('order_date'),
  expectedDate: text('expected_date'),
  totalAmount: real('total_amount'),
  currency: text('currency').notNull().default('THB'),
  paymentTerms: text('payment_terms'),
  shippingAddress: text('shipping_address'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Purchase Order Lines
export const sqlitePurchaseOrderLines = sqliteTable('purchase_order_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  poId: integer('po_id').notNull().references(() => sqlitePurchaseOrders.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  quantity: real('quantity').notNull(),
  receivedQuantity: real('received_quantity').notNull().default(0),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalPrice: real('total_price').notNull(),
  expectedDate: text('expected_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Sales Orders
export const sqliteSalesOrders = sqliteTable('sales_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  soNumber: text('so_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerContact: text('customer_contact'),
  customerAddress: text('customer_address'),
  status: text('status').notNull().default('draft'), // draft, confirmed, processing, shipped, delivered, cancelled
  orderDate: text('order_date'),
  requiredDate: text('required_date'),
  shippedDate: text('shipped_date'),
  totalAmount: real('total_amount'),
  currency: text('currency').notNull().default('THB'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiSalesOrderId: integer('vmi_sales_order_id'), // FK to vmi_sales_orders.id (set later)
  source: text('source').notNull().default('direct'), // direct, vmi, api
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Sales Order Lines
export const sqliteSalesOrderLines = sqliteTable('sales_order_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  soId: integer('so_id').notNull().references(() => sqliteSalesOrders.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  lotId: integer('lot_id').references(() => sqliteInventoryLots.id),
  quantity: real('quantity').notNull(),
  shippedQuantity: real('shipped_quantity').notNull().default(0),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  totalPrice: real('total_price').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Customers (ลูกค้า)
export const sqliteCustomers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  taxId: text('tax_id'),
  customerType: text('customer_type').notNull().default('hospital'), // hospital, clinic, pharmacy, distributor, traditional_medicine, spa_wellness, government, export, other
  creditLimit: real('credit_limit'),
  creditTermDays: integer('credit_term_days'),
  paymentTerms: text('payment_terms'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiCustomerId: text('vmi_customer_id'), // Customer ID from VMI Portal
  vmiPortalId: integer('vmi_portal_id'), // FK to vmi_portal_config.id (set later)
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Equipment/Machines
export const sqliteEquipment = sqliteTable('equipment', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type'),
  location: text('location'),
  manufacturer: text('manufacturer'),
  model: text('model'),
  serialNumber: text('serial_number'),
  installationDate: text('installation_date'),
  lastMaintenanceDate: text('last_maintenance_date'),
  nextMaintenanceDate: text('next_maintenance_date'),
  lastCalibrationDate: text('last_calibration_date'),
  nextCalibrationDate: text('next_calibration_date'),
  status: text('status').notNull().default('active'), // active, maintenance, calibration, inactive
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Maintenance Records
export const sqliteMaintenanceRecords = sqliteTable('maintenance_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  equipmentId: integer('equipment_id').notNull().references(() => sqliteEquipment.id),
  type: text('type').notNull(), // preventive, corrective, calibration
  description: text('description'),
  scheduledDate: text('scheduled_date'),
  completedDate: text('completed_date'),
  performedBy: integer('performed_by').references(() => sqliteUsers.id),
  cost: real('cost'),
  notes: text('notes'),
  status: text('status').notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Transactions
export const sqliteVMITransactions = sqliteTable('vmi_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id),
  transactionType: text('transaction_type').notNull(), // item_sync, price_sync, inventory_sync, order_poll, order_confirm, order_ship, receipt_check, connection_test
  itemId: integer('item_id').references(() => sqliteItems.id),
  quantity: real('quantity'),
  unit: text('unit'),
  data: text('data'), // JSON string for additional data
  status: text('status').notNull().default('pending'), // pending, sent, received, processed, error
  requestPayload: text('request_payload'), // JSON request body
  responsePayload: text('response_payload'), // JSON response body
  httpStatus: integer('http_status'), // HTTP status code
  durationMs: integer('duration_ms'), // Request duration in ms
  endpoint: text('endpoint'), // API endpoint called
  method: text('method'), // HTTP method
  sentAt: text('sent_at'),
  receivedAt: text('received_at'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Vendor Configuration
export const sqliteVMIVendorConfig = sqliteTable('vmi_vendor_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id).unique(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  vmiVendorId: text('vmi_vendor_id'),
  baseUrl: text('base_url'),
  isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(false),
  lastConnectionAt: text('last_connection_at'),
  syncItemsEnabled: integer('sync_items_enabled', { mode: 'boolean' }).notNull().default(true),
  syncPricesEnabled: integer('sync_prices_enabled', { mode: 'boolean' }).notNull().default(true),
  syncInventoryEnabled: integer('sync_inventory_enabled', { mode: 'boolean' }).notNull().default(true),
  orderPollIntervalMinutes: integer('order_poll_interval_minutes').notNull().default(15),
  lastItemsSyncAt: text('last_items_sync_at'),
  lastPricesSyncAt: text('last_prices_sync_at'),
  lastInventorySyncAt: text('last_inventory_sync_at'),
  lastOrdersPollAt: text('last_orders_poll_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Price Offers
export const sqliteVMIPriceOffers = sqliteTable('vmi_price_offers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  unitPrice: real('unit_price').notNull(),
  packPrice: real('pack_price'),
  moq: integer('moq'),
  leadTimeDays: integer('lead_time_days'),
  effectiveDate: text('effective_date').notNull(),
  expiryDate: text('expiry_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastSyncedAt: text('last_synced_at'),
  syncStatus: text('sync_status').notNull().default('pending'), // pending, synced, error
  syncError: text('sync_error'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Orders (from hospitals via VMI Portal)
export const sqliteVMIOrders = sqliteTable('vmi_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vendorId: integer('vendor_id').notNull().references(() => sqliteVendors.id),
  vmiOrderId: integer('vmi_order_id').notNull(),
  hospitalCode: text('hospital_code').notNull(),
  hospitalName: text('hospital_name').notNull(),
  poNumber: text('po_number').notNull(),
  warehouseName: text('warehouse_name'),
  status: text('status').notNull().default('submitted'), // submitted, confirmed, shipped, received, cancelled
  orderDate: text('order_date').notNull(),
  expectedDeliveryDate: text('expected_delivery_date'),
  totalValue: real('total_value').notNull(),
  itemCount: integer('item_count').notNull(),
  notes: text('notes'),
  localPoId: integer('local_po_id').references(() => sqlitePurchaseOrders.id),
  confirmedAt: text('confirmed_at'),
  shippedAt: text('shipped_at'),
  receivedAt: text('received_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Order Lines
export const sqliteVMIOrderLines = sqliteTable('vmi_order_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vmiOrderId: integer('vmi_order_id').notNull().references(() => sqliteVMIOrders.id),
  itemId: integer('item_id').references(() => sqliteItems.id),
  localCode: text('local_code').notNull(),
  itemName: text('item_name').notNull(),
  quantityOrdered: real('quantity_ordered').notNull(),
  quantityReceived: real('quantity_received').notNull().default(0),
  unitPrice: real('unit_price').notNull(),
  lineTotal: real('line_total').notNull(),
  unit: text('unit').notNull(),
  tppCode: text('tpp_code'),
  ttmtCode: text('ttmt_code'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// System Settings
export const sqliteSettings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  description: text('description'),
  category: text('category'),
  updatedBy: integer('updated_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// HR/Personnel Management Tables (SQLite)
// Feature: 007-hr-personnel-management
// ============================================

// HR Organization Units (โครงสร้างองค์กร)
export const sqliteHROrgUnits = sqliteTable('hr_org_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  type: text('type').notNull(), // company, site, division, department, section, unit
  parentId: integer('parent_id'), // Self-referencing, validated at application level
  siteId: integer('site_id'),
  isGmpCritical: integer('is_gmp_critical', { mode: 'boolean' }).notNull().default(false),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Positions (ตำแหน่งงาน)
export const sqliteHRPositions = sqliteTable('hr_positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  orgUnitId: integer('org_unit_id').notNull().references(() => sqliteHROrgUnits.id),
  jobGrade: text('job_grade'),
  isGmpCritical: integer('is_gmp_critical', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Job Descriptions (รายละเอียดตำแหน่งงาน)
export const sqliteHRJobDescriptions = sqliteTable('hr_job_descriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  positionId: integer('position_id').notNull().references(() => sqliteHRPositions.id),
  version: text('version').notNull(),
  responsibilities: text('responsibilities'),
  authorities: text('authorities'),
  qualifications: text('qualifications'),
  documentPath: text('document_path'),
  status: text('status').notNull().default('draft'), // draft, pending_approval, approved, obsolete
  effectiveFrom: text('effective_from'),
  effectiveTo: text('effective_to'),
  approvedBy: integer('approved_by').references(() => sqliteUsers.id),
  approvedAt: text('approved_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Employees (พนักงาน)
export const sqliteHREmployees = sqliteTable('hr_employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => sqliteUsers.id),
  employeeCode: text('employee_code').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  firstNameEn: text('first_name_en'),
  lastNameEn: text('last_name_en'),
  email: text('email'),
  phone: text('phone'),
  positionId: integer('position_id').references(() => sqliteHRPositions.id),
  orgUnitId: integer('org_unit_id').references(() => sqliteHROrgUnits.id),
  siteId: integer('site_id'),
  hireDate: text('hire_date').notNull(),
  terminationDate: text('termination_date'),
  status: text('status').notNull().default('active'), // active, inactive, terminated
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Employee Assignments (การมอบหมายงาน/โอนย้าย)
export const sqliteHREmployeeAssignments = sqliteTable('hr_employee_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  positionId: integer('position_id').references(() => sqliteHRPositions.id),
  orgUnitId: integer('org_unit_id').references(() => sqliteHROrgUnits.id),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  reason: text('reason'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Training Courses (หลักสูตรอบรม)
export const sqliteHRTrainingCourses = sqliteTable('hr_training_courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  category: text('category'),
  validityDays: integer('validity_days'),
  isMandatory: integer('is_mandatory', { mode: 'boolean' }).notNull().default(false),
  targetPositions: text('target_positions'), // JSON array of position IDs
  targetRoles: text('target_roles'), // JSON array of role codes
  durationHours: real('duration_hours'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Training Sessions (การจัดอบรม)
export const sqliteHRTrainingSessions = sqliteTable('hr_training_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courseId: integer('course_id').notNull().references(() => sqliteHRTrainingCourses.id),
  sessionDate: text('session_date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  location: text('location'),
  instructorId: integer('instructor_id').references(() => sqliteHREmployees.id),
  instructorExternal: text('instructor_external'),
  maxParticipants: integer('max_participants'),
  status: text('status').notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Training Records (ประวัติการอบรม)
export const sqliteHRTrainingRecords = sqliteTable('hr_training_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  sessionId: integer('session_id').references(() => sqliteHRTrainingSessions.id),
  courseId: integer('course_id').notNull().references(() => sqliteHRTrainingCourses.id),
  completionDate: text('completion_date').notNull(),
  expiryDate: text('expiry_date'),
  result: text('result').notNull(), // pass, fail, incomplete
  score: real('score'),
  assessedBy: integer('assessed_by').references(() => sqliteHREmployees.id),
  certificateNumber: text('certificate_number'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Authorizations (สิทธิ์อนุมัติ)
export const sqliteHRAuthorizations = sqliteTable('hr_authorizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  authType: text('auth_type').notNull(), // batch_release, sop_approval, deviation_approval, change_control_approval, capa_approval
  scopeSiteId: integer('scope_site_id'),
  scopeOrgUnitId: integer('scope_org_unit_id').references(() => sqliteHROrgUnits.id),
  scopeProductLines: text('scope_product_lines'), // JSON array
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  grantedBy: integer('granted_by').notNull().references(() => sqliteUsers.id),
  grantedAt: text('granted_at').notNull().default('CURRENT_TIMESTAMP'),
  revokedBy: integer('revoked_by').references(() => sqliteUsers.id),
  revokedAt: text('revoked_at'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Delegations (การมอบอำนาจ)
export const sqliteHRDelegations = sqliteTable('hr_delegations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorizationId: integer('authorization_id').notNull().references(() => sqliteHRAuthorizations.id),
  delegatorId: integer('delegator_id').notNull().references(() => sqliteHREmployees.id),
  delegateId: integer('delegate_id').notNull().references(() => sqliteHREmployees.id),
  reason: text('reason'),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Health Records (บันทึกสุขภาพ)
export const sqliteHRHealthRecords = sqliteTable('hr_health_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  examinationType: text('examination_type').notNull(), // pre_employment, periodic, special
  examinationDate: text('examination_date').notNull(),
  nextExamDue: text('next_exam_due'),
  fitnessStatus: text('fitness_status').notNull(), // fit, unfit, restricted
  restrictions: text('restrictions'),
  affectedAreas: text('affected_areas'), // JSON array - production_floor, raw_material, etc.
  medicalDetails: text('medical_details'), // SENSITIVE - filtered by role
  examinerName: text('examiner_name'),
  examinerNotes: text('examiner_notes'), // SENSITIVE - filtered by role
  recordedBy: integer('recorded_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Application Roles (บทบาทในระบบ)
export const sqliteHRAppRoles = sqliteTable('hr_app_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isSystemRole: integer('is_system_role', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Application Permissions (สิทธิ์ในระบบ)
export const sqliteHRAppPermissions = sqliteTable('hr_app_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  module: text('module').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Role Permissions (สิทธิ์ของบทบาท)
export const sqliteHRRolePermissions = sqliteTable('hr_role_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roleId: integer('role_id').notNull().references(() => sqliteHRAppRoles.id),
  permissionId: integer('permission_id').notNull().references(() => sqliteHRAppPermissions.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Employee Roles (บทบาทของพนักงาน)
export const sqliteHREmployeeRoles = sqliteTable('hr_employee_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  roleId: integer('role_id').notNull().references(() => sqliteHRAppRoles.id),
  scopeSiteId: integer('scope_site_id'),
  scopeOrgUnitId: integer('scope_org_unit_id').references(() => sqliteHROrgUnits.id),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  assignedBy: integer('assigned_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Notifications (การแจ้งเตือน)
export const sqliteHRNotifications = sqliteTable('hr_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').notNull().references(() => sqliteHREmployees.id),
  type: text('type').notNull(), // training_expiring, training_expired, health_check_due, authorization_expiring
  title: text('title').notNull(),
  message: text('message'),
  referenceType: text('reference_type'),
  referenceId: integer('reference_id'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// HR Audit Log (ประวัติการเปลี่ยนแปลง HR)
export const sqliteHRAuditLog = sqliteTable('hr_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => sqliteUsers.id),
  action: text('action').notNull(), // HR_ORG_CREATE, HR_EMP_UPDATE, etc.
  tableName: text('table_name').notNull(),
  recordId: integer('record_id').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// MySQL Schema (for production)
// ============================================

// Users table
export const mysqlUsers = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  department: varchar('department', { length: 100 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Audit Trail
export const mysqlAuditTrail = mysqlTable('audit_trail', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => mysqlUsers.id),
  action: varchar('action', { length: 50 }).notNull(),
  tableName: varchar('table_name', { length: 100 }),
  recordId: int('record_id'),
  oldValue: mysqlText('old_value'),
  newValue: mysqlText('new_value'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Item Categories (หมวดหมู่สินค้า)
export const mysqlItemCategories = mysqlTable('item_categories', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  description: varchar('description', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Item Units (หน่วยวัดสินค้า)
export const mysqlItemUnits = mysqlTable('item_units', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  symbol: varchar('symbol', { length: 20 }), // e.g., kg, g, L, pcs
  description: varchar('description', { length: 500 }),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Item Master
export const mysqlItems = mysqlTable('items', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  type: varchar('type', { length: 50 }).notNull(),
  category: varchar('category', { length: 100 }),
  primaryUnit: varchar('primary_unit', { length: 50 }).notNull(),
  secondaryUnit: varchar('secondary_unit', { length: 50 }),
  conversionRate: decimal('conversion_rate', { precision: 10, scale: 4 }),
  shelfLifeDays: int('shelf_life_days'),
  storageCondition: varchar('storage_condition', { length: 255 }),
  minStock: decimal('min_stock', { precision: 15, scale: 4 }).default('0'),
  maxStock: decimal('max_stock', { precision: 15, scale: 4 }),
  reorderPoint: decimal('reorder_point', { precision: 15, scale: 4 }),
  onHand: decimal('on_hand', { precision: 15, scale: 4 }).notNull().default('0'), // Cached on-hand quantity from released lots
  onHandCost: decimal('on_hand_cost', { precision: 15, scale: 4 }).notNull().default('0'), // Cached total cost of on-hand inventory
  isLotControlled: mysqlBoolean('is_lot_controlled').notNull().default(true),
  isFEFO: mysqlBoolean('is_fefo').notNull().default(true),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  // VMI Standard Codes - items need EITHER tppCode OR ttmtCode for VMI sync
  tppCode: varchar('tpp_code', { length: 13 }), // Thai Pharmaceutical Product code (13 digits)
  tppName: varchar('tpp_name', { length: 255 }), // TPP product name from VMI Portal
  ttmtCode: varchar('ttmt_code', { length: 10 }), // Thai Traditional Medicine Terminology (A + 8 digits)
  ttmtName: varchar('ttmt_name', { length: 255 }), // TTMT product name (FSN) from VMI Portal
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiSyncEnabled: mysqlBoolean('vmi_sync_enabled').notNull().default(false),
  lastVmiSyncAt: datetime('last_vmi_sync_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Herbal Attributes
export const mysqlHerbalAttributes = mysqlTable('herbal_attributes', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  botanicalName: varchar('botanical_name', { length: 255 }),
  partUsed: varchar('part_used', { length: 100 }),
  originCountry: varchar('origin_country', { length: 100 }),
  originProvince: varchar('origin_province', { length: 100 }),
  harvestDate: datetime('harvest_date'),
  dryingMethod: varchar('drying_method', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Vendors
export const mysqlVendors = mysqlTable('vendors', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: mysqlText('address'),
  taxId: varchar('tax_id', { length: 50 }),
  isApproved: mysqlBoolean('is_approved').notNull().default(false),
  isVMI: mysqlBoolean('is_vmi').notNull().default(false),
  leadTimeDays: int('lead_time_days'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Approved Vendor List
export const mysqlApprovedVendorList = mysqlTable('approved_vendor_list', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id),
  approvalDate: datetime('approval_date'),
  expiryDate: datetime('expiry_date'),
  isPreferred: mysqlBoolean('is_preferred').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Warehouses
export const mysqlWarehouses = mysqlTable('warehouses', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  location: varchar('location', { length: 255 }),
  temperatureMin: decimal('temperature_min', { precision: 5, scale: 2 }),
  temperatureMax: decimal('temperature_max', { precision: 5, scale: 2 }),
  humidityMin: decimal('humidity_min', { precision: 5, scale: 2 }),
  humidityMax: decimal('humidity_max', { precision: 5, scale: 2 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Warehouse Locations
export const mysqlWarehouseLocations = mysqlTable('warehouse_locations', {
  id: int('id').primaryKey().autoincrement(),
  warehouseId: int('warehouse_id').notNull().references(() => mysqlWarehouses.id),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }),
  zone: varchar('zone', { length: 50 }),
  rack: varchar('rack', { length: 50 }),
  shelf: varchar('shelf', { length: 50 }),
  bin: varchar('bin', { length: 50 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Inventory Lots
export const mysqlInventoryLots = mysqlTable('inventory_lots', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  lotNumber: varchar('lot_number', { length: 100 }).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  warehouseId: int('warehouse_id').notNull().references(() => mysqlWarehouses.id),
  locationId: int('location_id').references(() => mysqlWarehouseLocations.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  reservedQuantity: decimal('reserved_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  unit: varchar('unit', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('quarantine'),
  manufacturingDate: datetime('manufacturing_date'),
  expiryDate: datetime('expiry_date'),
  receivedDate: datetime('received_date'),
  vendorId: int('vendor_id').references(() => mysqlVendors.id),
  poNumber: varchar('po_number', { length: 50 }),
  coaNumber: varchar('coa_number', { length: 100 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Inventory Transactions
export const mysqlInventoryTransactions = mysqlTable('inventory_transactions', {
  id: int('id').primaryKey().autoincrement(),
  lotId: int('lot_id').notNull().references(() => mysqlInventoryLots.id),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: int('reference_id'),
  referenceNumber: varchar('reference_number', { length: 100 }),
  fromWarehouseId: int('from_warehouse_id').references(() => mysqlWarehouses.id),
  toWarehouseId: int('to_warehouse_id').references(() => mysqlWarehouses.id),
  reason: mysqlText('reason'),
  performedBy: int('performed_by').references(() => mysqlUsers.id),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// BOM
export const mysqlBOM = mysqlTable('bom', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  productId: int('product_id').notNull().references(() => mysqlItems.id),
  version: varchar('version', { length: 20 }).notNull().default('1.0'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  batchSize: decimal('batch_size', { precision: 15, scale: 4 }).notNull(),
  batchUnit: varchar('batch_unit', { length: 50 }).notNull(),
  yieldTarget: decimal('yield_target', { precision: 5, scale: 2 }),
  lossAllowance: decimal('loss_allowance', { precision: 5, scale: 2 }),
  effectiveDate: datetime('effective_date'),
  expiryDate: datetime('expiry_date'),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  approvedAt: datetime('approved_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// BOM Lines
export const mysqlBOMLines = mysqlTable('bom_lines', {
  id: int('id').primaryKey().autoincrement(),
  bomId: int('bom_id').notNull().references(() => mysqlBOM.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  sequence: int('sequence').notNull().default(1),
  isOptional: mysqlBoolean('is_optional').notNull().default(false),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Operations
export const mysqlOperations = mysqlTable('operations', {
  id: int('id').primaryKey().autoincrement(),
  bomId: int('bom_id').notNull().references(() => mysqlBOM.id),
  sequence: int('sequence').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: mysqlText('description'),
  workCenterId: int('work_center_id'),
  standardTime: decimal('standard_time', { precision: 10, scale: 2 }),
  setupTime: decimal('setup_time', { precision: 10, scale: 2 }),
  cleaningTime: decimal('cleaning_time', { precision: 10, scale: 2 }),
  instructions: mysqlText('instructions'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Work Orders
export const mysqlWorkOrders = mysqlTable('work_orders', {
  id: int('id').primaryKey().autoincrement(),
  woNumber: varchar('wo_number', { length: 50 }).notNull().unique(),
  bomId: int('bom_id').notNull().references(() => mysqlBOM.id),
  productId: int('product_id').notNull().references(() => mysqlItems.id),
  batchNumber: varchar('batch_number', { length: 100 }).notNull(),
  plannedQuantity: decimal('planned_quantity', { precision: 15, scale: 4 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('planned'),
  priority: int('priority').notNull().default(5),
  plannedStartDate: datetime('planned_start_date'),
  plannedEndDate: datetime('planned_end_date'),
  actualStartDate: datetime('actual_start_date'),
  actualEndDate: datetime('actual_end_date'),
  yieldPercentage: decimal('yield_percentage', { precision: 5, scale: 2 }),
  notes: mysqlText('notes'),
  createdBy: int('created_by').references(() => mysqlUsers.id),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Work Order Materials
export const mysqlWorkOrderMaterials = mysqlTable('work_order_materials', {
  id: int('id').primaryKey().autoincrement(),
  workOrderId: int('work_order_id').notNull().references(() => mysqlWorkOrders.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  lotId: int('lot_id').references(() => mysqlInventoryLots.id),
  plannedQuantity: decimal('planned_quantity', { precision: 15, scale: 4 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  issuedBy: int('issued_by').references(() => mysqlUsers.id),
  issuedAt: datetime('issued_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Batch Records
export const mysqlBatchRecords = mysqlTable('batch_records', {
  id: int('id').primaryKey().autoincrement(),
  workOrderId: int('work_order_id').notNull().references(() => mysqlWorkOrders.id),
  operationId: int('operation_id').notNull().references(() => mysqlOperations.id),
  sequence: int('sequence').notNull(),
  stepName: varchar('step_name', { length: 255 }).notNull(),
  instructions: mysqlText('instructions'),
  parameters: mysqlText('parameters'),
  actualValues: mysqlText('actual_values'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  startTime: datetime('start_time'),
  endTime: datetime('end_time'),
  performedBy: int('performed_by').references(() => mysqlUsers.id),
  verifiedBy: int('verified_by').references(() => mysqlUsers.id),
  verifiedAt: datetime('verified_at'),
  notes: mysqlText('notes'),
  attachments: mysqlText('attachments'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Quality Specifications
export const mysqlQualitySpecs = mysqlTable('quality_specs', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  testName: varchar('test_name', { length: 255 }).notNull(),
  testMethod: varchar('test_method', { length: 255 }),
  specification: varchar('specification', { length: 255 }),
  minValue: decimal('min_value', { precision: 15, scale: 4 }),
  maxValue: decimal('max_value', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 50 }),
  isCritical: mysqlBoolean('is_critical').notNull().default(false),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Quality Tests
export const mysqlQualityTests = mysqlTable('quality_tests', {
  id: int('id').primaryKey().autoincrement(),
  lotId: int('lot_id').notNull().references(() => mysqlInventoryLots.id),
  specId: int('spec_id').notNull().references(() => mysqlQualitySpecs.id),
  testType: varchar('test_type', { length: 50 }).notNull(),
  sampleNumber: varchar('sample_number', { length: 100 }),
  testDate: datetime('test_date'),
  result: varchar('result', { length: 255 }),
  numericResult: decimal('numeric_result', { precision: 15, scale: 4 }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  testedBy: int('tested_by').references(() => mysqlUsers.id),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  approvedAt: datetime('approved_at'),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Deviations
export const mysqlDeviations = mysqlTable('deviations', {
  id: int('id').primaryKey().autoincrement(),
  deviationNumber: varchar('deviation_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: mysqlText('description').notNull(),
  sourceType: varchar('source_type', { length: 50 }),
  sourceId: int('source_id'),
  severity: varchar('severity', { length: 50 }).notNull().default('minor'),
  status: varchar('status', { length: 50 }).notNull().default('open'),
  rootCause: mysqlText('root_cause'),
  correctiveAction: mysqlText('corrective_action'),
  preventiveAction: mysqlText('preventive_action'),
  reportedBy: int('reported_by').references(() => mysqlUsers.id),
  assignedTo: int('assigned_to').references(() => mysqlUsers.id),
  dueDate: datetime('due_date'),
  closedBy: int('closed_by').references(() => mysqlUsers.id),
  closedAt: datetime('closed_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Purchase Orders
export const mysqlPurchaseOrders = mysqlTable('purchase_orders', {
  id: int('id').primaryKey().autoincrement(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  orderDate: datetime('order_date'),
  expectedDate: datetime('expected_date'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 10 }).notNull().default('THB'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  shippingAddress: mysqlText('shipping_address'),
  notes: mysqlText('notes'),
  createdBy: int('created_by').references(() => mysqlUsers.id),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  approvedAt: datetime('approved_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Purchase Order Lines
export const mysqlPurchaseOrderLines = mysqlTable('purchase_order_lines', {
  id: int('id').primaryKey().autoincrement(),
  poId: int('po_id').notNull().references(() => mysqlPurchaseOrders.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  unit: varchar('unit', { length: 50 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 15, scale: 2 }).notNull(),
  expectedDate: datetime('expected_date'),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Sales Orders
export const mysqlSalesOrders = mysqlTable('sales_orders', {
  id: int('id').primaryKey().autoincrement(),
  soNumber: varchar('so_number', { length: 50 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerContact: varchar('customer_contact', { length: 255 }),
  customerAddress: mysqlText('customer_address'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  orderDate: datetime('order_date'),
  requiredDate: datetime('required_date'),
  shippedDate: datetime('shipped_date'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 10 }).notNull().default('THB'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  notes: mysqlText('notes'),
  createdBy: int('created_by').references(() => mysqlUsers.id),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiSalesOrderId: int('vmi_sales_order_id'), // FK to vmi_sales_orders.id (set later)
  source: varchar('source', { length: 20 }).notNull().default('direct'), // direct, vmi, api
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Sales Order Lines
export const mysqlSalesOrderLines = mysqlTable('sales_order_lines', {
  id: int('id').primaryKey().autoincrement(),
  soId: int('so_id').notNull().references(() => mysqlSalesOrders.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  lotId: int('lot_id').references(() => mysqlInventoryLots.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }).notNull(),
  shippedQuantity: decimal('shipped_quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  unit: varchar('unit', { length: 50 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 15, scale: 2 }).notNull(),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Customers (ลูกค้า)
export const mysqlCustomers = mysqlTable('customers', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: mysqlText('address'),
  taxId: varchar('tax_id', { length: 50 }),
  customerType: varchar('customer_type', { length: 50 }).notNull().default('hospital'), // hospital, clinic, pharmacy, distributor, traditional_medicine, spa_wellness, government, export, other
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }),
  creditTermDays: int('credit_term_days'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  notes: mysqlText('notes'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  // VMI Vendor Sync fields (008-vmi-vendor-sync)
  vmiCustomerId: varchar('vmi_customer_id', { length: 50 }), // Customer ID from VMI Portal
  vmiPortalId: int('vmi_portal_id'), // FK to vmi_portal_config.id (set later)
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Equipment
export const mysqlEquipment = mysqlTable('equipment', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }),
  location: varchar('location', { length: 255 }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  installationDate: datetime('installation_date'),
  lastMaintenanceDate: datetime('last_maintenance_date'),
  nextMaintenanceDate: datetime('next_maintenance_date'),
  lastCalibrationDate: datetime('last_calibration_date'),
  nextCalibrationDate: datetime('next_calibration_date'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Maintenance Records
export const mysqlMaintenanceRecords = mysqlTable('maintenance_records', {
  id: int('id').primaryKey().autoincrement(),
  equipmentId: int('equipment_id').notNull().references(() => mysqlEquipment.id),
  type: varchar('type', { length: 50 }).notNull(),
  description: mysqlText('description'),
  scheduledDate: datetime('scheduled_date'),
  completedDate: datetime('completed_date'),
  performedBy: int('performed_by').references(() => mysqlUsers.id),
  cost: decimal('cost', { precision: 15, scale: 2 }),
  notes: mysqlText('notes'),
  status: varchar('status', { length: 50 }).notNull().default('scheduled'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Transactions
export const mysqlVMITransactions = mysqlTable('vmi_transactions', {
  id: int('id').primaryKey().autoincrement(),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(), // item_sync, price_sync, inventory_sync, order_poll, order_confirm, order_ship, receipt_check, connection_test
  itemId: int('item_id').references(() => mysqlItems.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 50 }),
  data: mysqlText('data'),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, sent, received, processed, error
  requestPayload: mysqlText('request_payload'), // JSON request body
  responsePayload: mysqlText('response_payload'), // JSON response body
  httpStatus: int('http_status'), // HTTP status code
  durationMs: int('duration_ms'), // Request duration in ms
  endpoint: varchar('endpoint', { length: 255 }), // API endpoint called
  method: varchar('method', { length: 10 }), // HTTP method
  sentAt: datetime('sent_at'),
  receivedAt: datetime('received_at'),
  errorMessage: mysqlText('error_message'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// VMI Vendor Configuration
export const mysqlVMIVendorConfig = mysqlTable('vmi_vendor_config', {
  id: int('id').primaryKey().autoincrement(),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id).unique(),
  apiKeyEncrypted: mysqlText('api_key_encrypted').notNull(),
  vmiVendorId: varchar('vmi_vendor_id', { length: 50 }),
  baseUrl: varchar('base_url', { length: 255 }),
  isConnected: mysqlBoolean('is_connected').notNull().default(false),
  lastConnectionAt: datetime('last_connection_at'),
  syncItemsEnabled: mysqlBoolean('sync_items_enabled').notNull().default(true),
  syncPricesEnabled: mysqlBoolean('sync_prices_enabled').notNull().default(true),
  syncInventoryEnabled: mysqlBoolean('sync_inventory_enabled').notNull().default(true),
  orderPollIntervalMinutes: int('order_poll_interval_minutes').notNull().default(15),
  lastItemsSyncAt: datetime('last_items_sync_at'),
  lastPricesSyncAt: datetime('last_prices_sync_at'),
  lastInventorySyncAt: datetime('last_inventory_sync_at'),
  lastOrdersPollAt: datetime('last_orders_poll_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Price Offers
export const mysqlVMIPriceOffers = mysqlTable('vmi_price_offers', {
  id: int('id').primaryKey().autoincrement(),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  packPrice: decimal('pack_price', { precision: 15, scale: 2 }),
  moq: int('moq'),
  leadTimeDays: int('lead_time_days'),
  effectiveDate: datetime('effective_date').notNull(),
  expiryDate: datetime('expiry_date'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  lastSyncedAt: datetime('last_synced_at'),
  syncStatus: varchar('sync_status', { length: 20 }).notNull().default('pending'), // pending, synced, error
  syncError: mysqlText('sync_error'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Orders (from hospitals via VMI Portal)
export const mysqlVMIOrders = mysqlTable('vmi_orders', {
  id: int('id').primaryKey().autoincrement(),
  vendorId: int('vendor_id').notNull().references(() => mysqlVendors.id),
  vmiOrderId: int('vmi_order_id').notNull(),
  hospitalCode: varchar('hospital_code', { length: 20 }).notNull(),
  hospitalName: varchar('hospital_name', { length: 255 }).notNull(),
  poNumber: varchar('po_number', { length: 50 }).notNull(),
  warehouseName: varchar('warehouse_name', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('submitted'), // submitted, confirmed, shipped, received, cancelled
  orderDate: datetime('order_date').notNull(),
  expectedDeliveryDate: datetime('expected_delivery_date'),
  totalValue: decimal('total_value', { precision: 15, scale: 2 }).notNull(),
  itemCount: int('item_count').notNull(),
  notes: mysqlText('notes'),
  localPoId: int('local_po_id').references(() => mysqlPurchaseOrders.id),
  confirmedAt: datetime('confirmed_at'),
  shippedAt: datetime('shipped_at'),
  receivedAt: datetime('received_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Order Lines
export const mysqlVMIOrderLines = mysqlTable('vmi_order_lines', {
  id: int('id').primaryKey().autoincrement(),
  vmiOrderId: int('vmi_order_id').notNull().references(() => mysqlVMIOrders.id),
  itemId: int('item_id').references(() => mysqlItems.id),
  localCode: varchar('local_code', { length: 50 }).notNull(),
  itemName: varchar('item_name', { length: 500 }).notNull(),
  quantityOrdered: decimal('quantity_ordered', { precision: 15, scale: 4 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 15, scale: 4 }).notNull().default('0'),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  tppCode: varchar('tpp_code', { length: 13 }),
  ttmtCode: varchar('ttmt_code', { length: 10 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Settings
export const mysqlSettings = mysqlTable('settings', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: mysqlText('value'),
  description: varchar('description', { length: 255 }),
  category: varchar('category', { length: 100 }),
  updatedBy: int('updated_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// ============================================
// Report Categories (MySQL)
// ============================================
export const mysqlReportCategories = mysqlTable('report_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  parentId: int('parent_id'),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// ============================================
// Report Templates (MySQL)
// ============================================
export const mysqlReportTemplates = mysqlTable('report_templates', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 200 }).notNull(),
  description: varchar('description', { length: 1000 }),
  code: varchar('code', { length: 50 }).notNull().unique(),
  categoryId: int('category_id').references(() => mysqlReportCategories.id),
  definition: mysqlText('definition').notNull(),
  dataSourceConfig: mysqlText('data_source_config'), // JSON stored as text
  parametersSchema: mysqlText('parameters_schema'), // JSON stored as text
  version: int('version').notNull().default(1),
  isPublished: mysqlBoolean('is_published').notNull().default(false),
  isSystem: mysqlBoolean('is_system').notNull().default(false),
  thumbnail: mysqlText('thumbnail'), // Base64 encoded
  createdBy: int('created_by').notNull().references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedBy: int('updated_by').references(() => mysqlUsers.id),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// ============================================
// Report Permissions (MySQL)
// ============================================
export const mysqlReportPermissions = mysqlTable('report_permissions', {
  id: int('id').primaryKey().autoincrement(),
  templateId: int('template_id').notNull().references(() => mysqlReportTemplates.id),
  role: varchar('role', { length: 50 }).notNull(),
  canView: mysqlBoolean('can_view').notNull().default(true),
  canDesign: mysqlBoolean('can_design').notNull().default(false),
  canExport: mysqlBoolean('can_export').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// ============================================
// Report Executions - Audit Trail (MySQL)
// ============================================
export const mysqlReportExecutions = mysqlTable('report_executions', {
  id: int('id').primaryKey().autoincrement(),
  templateId: int('template_id').notNull().references(() => mysqlReportTemplates.id),
  userId: int('user_id').notNull().references(() => mysqlUsers.id),
  action: varchar('action', { length: 20 }).notNull(), // 'view', 'export', 'print'
  parameters: mysqlText('parameters'), // JSON stored as text
  exportFormat: varchar('export_format', { length: 20 }),
  executedAt: datetime('executed_at').notNull().default(new Date()),
  durationMs: int('duration_ms'),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'error', 'cancelled'
  errorMessage: varchar('error_message', { length: 1000 }),
  ipAddress: varchar('ip_address', { length: 45 }),
});

// ============================================
// HR/Personnel Management Tables (MySQL)
// Feature: 007-hr-personnel-management
// ============================================

// HR Organization Units (โครงสร้างองค์กร)
export const mysqlHROrgUnits = mysqlTable('hr_org_units', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  type: varchar('type', { length: 20 }).notNull(), // company, site, division, department, section, unit
  parentId: int('parent_id'),
  siteId: int('site_id'),
  isGmpCritical: mysqlBoolean('is_gmp_critical').notNull().default(false),
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Positions (ตำแหน่งงาน)
export const mysqlHRPositions = mysqlTable('hr_positions', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 100 }).notNull(),
  titleEn: varchar('title_en', { length: 100 }),
  orgUnitId: int('org_unit_id').notNull().references(() => mysqlHROrgUnits.id),
  jobGrade: varchar('job_grade', { length: 10 }),
  isGmpCritical: mysqlBoolean('is_gmp_critical').notNull().default(false),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Job Descriptions (รายละเอียดตำแหน่งงาน)
export const mysqlHRJobDescriptions = mysqlTable('hr_job_descriptions', {
  id: int('id').primaryKey().autoincrement(),
  positionId: int('position_id').notNull().references(() => mysqlHRPositions.id),
  version: varchar('version', { length: 10 }).notNull(),
  responsibilities: mysqlText('responsibilities'),
  authorities: mysqlText('authorities'),
  qualifications: mysqlText('qualifications'),
  documentPath: varchar('document_path', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  effectiveFrom: datetime('effective_from'),
  effectiveTo: datetime('effective_to'),
  approvedBy: int('approved_by').references(() => mysqlUsers.id),
  approvedAt: datetime('approved_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Employees (พนักงาน)
export const mysqlHREmployees = mysqlTable('hr_employees', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => mysqlUsers.id),
  employeeCode: varchar('employee_code', { length: 20 }).notNull().unique(),
  firstName: varchar('first_name', { length: 50 }).notNull(),
  lastName: varchar('last_name', { length: 50 }).notNull(),
  firstNameEn: varchar('first_name_en', { length: 50 }),
  lastNameEn: varchar('last_name_en', { length: 50 }),
  email: varchar('email', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  positionId: int('position_id').references(() => mysqlHRPositions.id),
  orgUnitId: int('org_unit_id').references(() => mysqlHROrgUnits.id),
  siteId: int('site_id'),
  hireDate: datetime('hire_date').notNull(),
  terminationDate: datetime('termination_date'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Employee Assignments (การมอบหมายงาน/โอนย้าย)
export const mysqlHREmployeeAssignments = mysqlTable('hr_employee_assignments', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  positionId: int('position_id').references(() => mysqlHRPositions.id),
  orgUnitId: int('org_unit_id').references(() => mysqlHROrgUnits.id),
  isPrimary: mysqlBoolean('is_primary').notNull().default(false),
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to'),
  reason: varchar('reason', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// HR Training Courses (หลักสูตรอบรม)
export const mysqlHRTrainingCourses = mysqlTable('hr_training_courses', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  description: mysqlText('description'),
  category: varchar('category', { length: 50 }),
  validityDays: int('validity_days'),
  isMandatory: mysqlBoolean('is_mandatory').notNull().default(false),
  targetPositions: mysqlText('target_positions'), // JSON array of position IDs
  targetRoles: mysqlText('target_roles'), // JSON array of role codes
  durationHours: decimal('duration_hours', { precision: 5, scale: 2 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Training Sessions (การจัดอบรม)
export const mysqlHRTrainingSessions = mysqlTable('hr_training_sessions', {
  id: int('id').primaryKey().autoincrement(),
  courseId: int('course_id').notNull().references(() => mysqlHRTrainingCourses.id),
  sessionDate: datetime('session_date').notNull(),
  startTime: varchar('start_time', { length: 5 }),
  endTime: varchar('end_time', { length: 5 }),
  location: varchar('location', { length: 100 }),
  instructorId: int('instructor_id').references(() => mysqlHREmployees.id),
  instructorExternal: varchar('instructor_external', { length: 100 }),
  maxParticipants: int('max_participants'),
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Training Records (ประวัติการอบรม)
export const mysqlHRTrainingRecords = mysqlTable('hr_training_records', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  sessionId: int('session_id').references(() => mysqlHRTrainingSessions.id),
  courseId: int('course_id').notNull().references(() => mysqlHRTrainingCourses.id),
  completionDate: datetime('completion_date').notNull(),
  expiryDate: datetime('expiry_date'),
  result: varchar('result', { length: 20 }).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }),
  assessedBy: int('assessed_by').references(() => mysqlHREmployees.id),
  certificateNumber: varchar('certificate_number', { length: 50 }),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Authorizations (สิทธิ์อนุมัติ)
export const mysqlHRAuthorizations = mysqlTable('hr_authorizations', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  authType: varchar('auth_type', { length: 30 }).notNull(),
  scopeSiteId: int('scope_site_id'),
  scopeOrgUnitId: int('scope_org_unit_id').references(() => mysqlHROrgUnits.id),
  scopeProductLines: mysqlText('scope_product_lines'), // JSON array
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to'),
  grantedBy: int('granted_by').notNull().references(() => mysqlUsers.id),
  grantedAt: datetime('granted_at').notNull().default(new Date()),
  revokedBy: int('revoked_by').references(() => mysqlUsers.id),
  revokedAt: datetime('revoked_at'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Delegations (การมอบอำนาจ)
export const mysqlHRDelegations = mysqlTable('hr_delegations', {
  id: int('id').primaryKey().autoincrement(),
  authorizationId: int('authorization_id').notNull().references(() => mysqlHRAuthorizations.id),
  delegatorId: int('delegator_id').notNull().references(() => mysqlHREmployees.id),
  delegateId: int('delegate_id').notNull().references(() => mysqlHREmployees.id),
  reason: varchar('reason', { length: 255 }),
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Health Records (บันทึกสุขภาพ)
export const mysqlHRHealthRecords = mysqlTable('hr_health_records', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  examinationType: varchar('examination_type', { length: 20 }).notNull(),
  examinationDate: datetime('examination_date').notNull(),
  nextExamDue: datetime('next_exam_due'),
  fitnessStatus: varchar('fitness_status', { length: 20 }).notNull(),
  restrictions: mysqlText('restrictions'),
  affectedAreas: mysqlText('affected_areas'), // JSON array
  medicalDetails: mysqlText('medical_details'), // SENSITIVE - filtered by role
  examinerName: varchar('examiner_name', { length: 100 }),
  examinerNotes: mysqlText('examiner_notes'), // SENSITIVE - filtered by role
  recordedBy: int('recorded_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Application Roles (บทบาทในระบบ)
export const mysqlHRAppRoles = mysqlTable('hr_app_roles', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  isSystemRole: mysqlBoolean('is_system_role').notNull().default(false),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Application Permissions (สิทธิ์ในระบบ)
export const mysqlHRAppPermissions = mysqlTable('hr_app_permissions', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// HR Role Permissions (สิทธิ์ของบทบาท)
export const mysqlHRRolePermissions = mysqlTable('hr_role_permissions', {
  id: int('id').primaryKey().autoincrement(),
  roleId: int('role_id').notNull().references(() => mysqlHRAppRoles.id),
  permissionId: int('permission_id').notNull().references(() => mysqlHRAppPermissions.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// HR Employee Roles (บทบาทของพนักงาน)
export const mysqlHREmployeeRoles = mysqlTable('hr_employee_roles', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  roleId: int('role_id').notNull().references(() => mysqlHRAppRoles.id),
  scopeSiteId: int('scope_site_id'),
  scopeOrgUnitId: int('scope_org_unit_id').references(() => mysqlHROrgUnits.id),
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to'),
  assignedBy: int('assigned_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// HR Notifications (การแจ้งเตือน)
export const mysqlHRNotifications = mysqlTable('hr_notifications', {
  id: int('id').primaryKey().autoincrement(),
  employeeId: int('employee_id').notNull().references(() => mysqlHREmployees.id),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: mysqlText('message'),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: int('reference_id'),
  isRead: mysqlBoolean('is_read').notNull().default(false),
  readAt: datetime('read_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// HR Audit Log (ประวัติการเปลี่ยนแปลง HR)
export const mysqlHRAuditLog = mysqlTable('hr_audit_log', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => mysqlUsers.id),
  action: varchar('action', { length: 30 }).notNull(),
  tableName: varchar('table_name', { length: 50 }).notNull(),
  recordId: int('record_id').notNull(),
  oldValue: mysqlText('old_value'),
  newValue: mysqlText('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// ============================================
// VMI Portal Integration (Vendor Side) - MySQL
// Feature: 008-vmi-vendor-sync
// This system IS the vendor - syncs TO VMI portals, receives orders FROM portals
// ============================================

// VMI Portal Configuration
export const mysqlVmiPortalConfig = mysqlTable('vmi_portal_config', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  portalUrl: varchar('portal_url', { length: 255 }).notNull(),
  apiKeyEncrypted: mysqlText('api_key_encrypted').notNull(),
  vendorId: varchar('vendor_id', { length: 50 }).notNull(), // Our vendor ID in this portal
  isEnabled: mysqlBoolean('is_enabled').notNull().default(true),
  syncInventoryEnabled: mysqlBoolean('sync_inventory_enabled').notNull().default(true),
  syncInventoryInterval: int('sync_inventory_interval').notNull().default(60), // minutes
  syncItemsEnabled: mysqlBoolean('sync_items_enabled').notNull().default(true),
  syncItemsInterval: int('sync_items_interval').notNull().default(1440), // minutes (24h default)
  syncPricesEnabled: mysqlBoolean('sync_prices_enabled').notNull().default(true),
  syncPricesInterval: int('sync_prices_interval').notNull().default(1440), // minutes (24h default)
  orderPollingEnabled: mysqlBoolean('order_polling_enabled').notNull().default(true),
  orderPollingInterval: int('order_polling_interval').notNull().default(15), // minutes
  lastInventorySyncAt: datetime('last_inventory_sync_at'),
  lastItemsSyncAt: datetime('last_items_sync_at'),
  lastPricesSyncAt: datetime('last_prices_sync_at'),
  lastOrdersPollAt: datetime('last_orders_poll_at'),
  connectionStatus: varchar('connection_status', { length: 20 }).notNull().default('disconnected'), // connected, disconnected, error
  lastErrorMessage: mysqlText('last_error_message'),
  createdBy: int('created_by').references(() => mysqlUsers.id),
  updatedBy: int('updated_by').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Sync History
export const mysqlVmiSyncHistory = mysqlTable('vmi_sync_history', {
  id: int('id').primaryKey().autoincrement(),
  portalId: int('portal_id').notNull().references(() => mysqlVmiPortalConfig.id),
  syncType: varchar('sync_type', { length: 20 }).notNull(), // inventory, items, prices, orders
  triggerType: varchar('trigger_type', { length: 20 }).notNull(), // manual, scheduled, threshold
  status: varchar('status', { length: 20 }).notNull(), // running, completed, failed, partial
  itemsTotal: int('items_total').notNull().default(0),
  itemsProcessed: int('items_processed').notNull().default(0),
  itemsFailed: int('items_failed').notNull().default(0),
  errorDetails: mysqlText('error_details'), // JSON array of {itemId, itemCode, error}
  triggeredBy: int('triggered_by').references(() => mysqlUsers.id),
  startedAt: datetime('started_at').notNull().default(new Date()),
  completedAt: datetime('completed_at'),
});

// VMI Sales Orders (orders received FROM VMI Portal INTO our sales system)
export const mysqlVmiSalesOrders = mysqlTable('vmi_sales_orders', {
  id: int('id').primaryKey().autoincrement(),
  portalId: int('portal_id').notNull().references(() => mysqlVmiPortalConfig.id),
  vmiOrderId: varchar('vmi_order_id', { length: 50 }).notNull(), // Order ID from VMI Portal
  salesOrderId: int('sales_order_id').references(() => mysqlSalesOrders.id),
  customerId: int('customer_id').references(() => mysqlCustomers.id),
  vmiStatus: varchar('vmi_status', { length: 20 }).notNull(), // submitted, confirmed, shipped, received, cancelled
  localStatus: varchar('local_status', { length: 20 }).notNull().default('pending'), // pending, confirmed, processing, shipped, delivered, cancelled
  vmiCustomerId: varchar('vmi_customer_id', { length: 50 }).notNull(), // Customer ID from VMI Portal
  vmiCustomerName: varchar('vmi_customer_name', { length: 200 }).notNull(), // Customer name from VMI Portal
  orderDate: datetime('order_date').notNull(),
  requiredDate: datetime('required_date'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('THB'),
  orderDataJson: mysqlText('order_data_json').notNull(), // Full order data from VMI Portal
  polledAt: datetime('polled_at').notNull().default(new Date()),
  confirmedAt: datetime('confirmed_at'),
  shippedAt: datetime('shipped_at'),
  deliveredAt: datetime('delivered_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// VMI Sales Order Lines
export const mysqlVmiSalesOrderLines = mysqlTable('vmi_sales_order_lines', {
  id: int('id').primaryKey().autoincrement(),
  vmiSalesOrderId: int('vmi_sales_order_id').notNull().references(() => mysqlVmiSalesOrders.id),
  itemId: int('item_id').references(() => mysqlItems.id), // Matched local item
  vmiLineId: varchar('vmi_line_id', { length: 50 }).notNull(), // Line ID from VMI Portal
  tppCode: varchar('tpp_code', { length: 20 }),
  ttmtCode: varchar('ttmt_code', { length: 20 }),
  localCode: varchar('local_code', { length: 50 }), // Our item code (if matched)
  itemName: varchar('item_name', { length: 200 }).notNull(), // Item name from VMI
  quantity: decimal('quantity', { precision: 15, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  matchStatus: varchar('match_status', { length: 20 }).notNull().default('unmatched'), // unmatched, matched, multiple_matches, manual_mapped
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// ============================================
// Report Categories (SQLite - for testing)
// ============================================
export const sqliteReportCategories = sqliteTable('report_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// Report Templates (SQLite - for testing)
// ============================================
export const sqliteReportTemplates = sqliteTable('report_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  code: text('code').notNull().unique(),
  categoryId: integer('category_id').references(() => sqliteReportCategories.id),
  definition: text('definition').notNull(),
  dataSourceConfig: text('data_source_config'), // JSON stored as text
  parametersSchema: text('parameters_schema'), // JSON stored as text
  version: integer('version').notNull().default(1),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  thumbnail: text('thumbnail'), // Base64 encoded
  createdBy: integer('created_by').notNull().references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedBy: integer('updated_by').references(() => sqliteUsers.id),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// Report Permissions (SQLite - for testing)
// ============================================
export const sqliteReportPermissions = sqliteTable('report_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').notNull().references(() => sqliteReportTemplates.id),
  role: text('role').notNull(),
  canView: integer('can_view', { mode: 'boolean' }).notNull().default(true),
  canDesign: integer('can_design', { mode: 'boolean' }).notNull().default(false),
  canExport: integer('can_export', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// Report Executions - Audit Trail (SQLite - for testing)
// ============================================
export const sqliteReportExecutions = sqliteTable('report_executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: integer('template_id').notNull().references(() => sqliteReportTemplates.id),
  userId: integer('user_id').notNull().references(() => sqliteUsers.id),
  action: text('action').notNull(), // 'view', 'export', 'print'
  parameters: text('parameters'), // JSON stored as text
  exportFormat: text('export_format'),
  executedAt: text('executed_at').notNull().default('CURRENT_TIMESTAMP'),
  durationMs: integer('duration_ms'),
  status: text('status').notNull(), // 'success', 'error', 'cancelled'
  errorMessage: text('error_message'),
  ipAddress: text('ip_address'),
});

// ============================================
// VMI Portal Integration (Vendor Side) - SQLite
// Feature: 008-vmi-vendor-sync
// This system IS the vendor - syncs TO VMI portals, receives orders FROM portals
// ============================================

// VMI Portal Configuration
export const sqliteVmiPortalConfig = sqliteTable('vmi_portal_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  portalUrl: text('portal_url').notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  vendorId: text('vendor_id').notNull(), // Our vendor ID in this portal
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  syncInventoryEnabled: integer('sync_inventory_enabled', { mode: 'boolean' }).notNull().default(true),
  syncInventoryInterval: integer('sync_inventory_interval').notNull().default(60), // minutes
  syncItemsEnabled: integer('sync_items_enabled', { mode: 'boolean' }).notNull().default(true),
  syncItemsInterval: integer('sync_items_interval').notNull().default(1440), // minutes (24h default)
  syncPricesEnabled: integer('sync_prices_enabled', { mode: 'boolean' }).notNull().default(true),
  syncPricesInterval: integer('sync_prices_interval').notNull().default(1440), // minutes (24h default)
  orderPollingEnabled: integer('order_polling_enabled', { mode: 'boolean' }).notNull().default(true),
  orderPollingInterval: integer('order_polling_interval').notNull().default(15), // minutes
  lastInventorySyncAt: text('last_inventory_sync_at'),
  lastItemsSyncAt: text('last_items_sync_at'),
  lastPricesSyncAt: text('last_prices_sync_at'),
  lastOrdersPollAt: text('last_orders_poll_at'),
  connectionStatus: text('connection_status').notNull().default('disconnected'), // connected, disconnected, error
  lastErrorMessage: text('last_error_message'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  updatedBy: integer('updated_by').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Sync History
export const sqliteVmiSyncHistory = sqliteTable('vmi_sync_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portalId: integer('portal_id').notNull().references(() => sqliteVmiPortalConfig.id),
  syncType: text('sync_type').notNull(), // inventory, items, prices, orders
  triggerType: text('trigger_type').notNull(), // manual, scheduled, threshold
  status: text('status').notNull(), // running, completed, failed, partial
  itemsTotal: integer('items_total').notNull().default(0),
  itemsProcessed: integer('items_processed').notNull().default(0),
  itemsFailed: integer('items_failed').notNull().default(0),
  errorDetails: text('error_details'), // JSON array of {itemId, itemCode, error}
  triggeredBy: integer('triggered_by').references(() => sqliteUsers.id),
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  completedAt: text('completed_at'),
});

// VMI Sales Orders (orders received FROM VMI Portal INTO our sales system)
export const sqliteVmiSalesOrders = sqliteTable('vmi_sales_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portalId: integer('portal_id').notNull().references(() => sqliteVmiPortalConfig.id),
  vmiOrderId: text('vmi_order_id').notNull(), // Order ID from VMI Portal
  salesOrderId: integer('sales_order_id').references(() => sqliteSalesOrders.id),
  customerId: integer('customer_id').references(() => sqliteCustomers.id),
  vmiStatus: text('vmi_status').notNull(), // submitted, confirmed, shipped, received, cancelled
  localStatus: text('local_status').notNull().default('pending'), // pending, confirmed, processing, shipped, delivered, cancelled
  vmiCustomerId: text('vmi_customer_id').notNull(), // Customer ID from VMI Portal
  vmiCustomerName: text('vmi_customer_name').notNull(), // Customer name from VMI Portal
  orderDate: text('order_date').notNull(),
  requiredDate: text('required_date'),
  totalAmount: real('total_amount').notNull(),
  currency: text('currency').notNull().default('THB'),
  orderDataJson: text('order_data_json').notNull(), // Full order data from VMI Portal
  polledAt: text('polled_at').notNull().default('CURRENT_TIMESTAMP'),
  confirmedAt: text('confirmed_at'),
  shippedAt: text('shipped_at'),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// VMI Sales Order Lines
export const sqliteVmiSalesOrderLines = sqliteTable('vmi_sales_order_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  vmiSalesOrderId: integer('vmi_sales_order_id').notNull().references(() => sqliteVmiSalesOrders.id),
  itemId: integer('item_id').references(() => sqliteItems.id), // Matched local item
  vmiLineId: text('vmi_line_id').notNull(), // Line ID from VMI Portal
  tppCode: text('tpp_code'),
  ttmtCode: text('ttmt_code'),
  localCode: text('local_code'), // Our item code (if matched)
  itemName: text('item_name').notNull(), // Item name from VMI
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').notNull(),
  lineTotal: real('line_total').notNull(),
  matchStatus: text('match_status').notNull().default('unmatched'), // unmatched, matched, multiple_matches, manual_mapped
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Export type aliases for easier use
export type User = typeof sqliteUsers.$inferSelect;
export type NewUser = typeof sqliteUsers.$inferInsert;
export type Item = typeof sqliteItems.$inferSelect;
export type NewItem = typeof sqliteItems.$inferInsert;
export type ItemCategory = typeof sqliteItemCategories.$inferSelect;
export type NewItemCategory = typeof sqliteItemCategories.$inferInsert;
export type ItemUnit = typeof sqliteItemUnits.$inferSelect;
export type NewItemUnit = typeof sqliteItemUnits.$inferInsert;
export type Vendor = typeof sqliteVendors.$inferSelect;
export type NewVendor = typeof sqliteVendors.$inferInsert;
export type InventoryLot = typeof sqliteInventoryLots.$inferSelect;
export type NewInventoryLot = typeof sqliteInventoryLots.$inferInsert;
export type WorkOrder = typeof sqliteWorkOrders.$inferSelect;
export type NewWorkOrder = typeof sqliteWorkOrders.$inferInsert;
export type PurchaseOrder = typeof sqlitePurchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof sqlitePurchaseOrders.$inferInsert;
export type SalesOrder = typeof sqliteSalesOrders.$inferSelect;
export type NewSalesOrder = typeof sqliteSalesOrders.$inferInsert;
export type Customer = typeof sqliteCustomers.$inferSelect;
export type NewCustomer = typeof sqliteCustomers.$inferInsert;
export type ReportCategory = typeof sqliteReportCategories.$inferSelect;
export type NewReportCategory = typeof sqliteReportCategories.$inferInsert;
export type ReportTemplate = typeof sqliteReportTemplates.$inferSelect;
export type NewReportTemplate = typeof sqliteReportTemplates.$inferInsert;
export type ReportPermission = typeof sqliteReportPermissions.$inferSelect;
export type NewReportPermission = typeof sqliteReportPermissions.$inferInsert;
export type ReportExecution = typeof sqliteReportExecutions.$inferSelect;
export type NewReportExecution = typeof sqliteReportExecutions.$inferInsert;
export type VMIVendorConfig = typeof sqliteVMIVendorConfig.$inferSelect;
export type NewVMIVendorConfig = typeof sqliteVMIVendorConfig.$inferInsert;
export type VMIPriceOffer = typeof sqliteVMIPriceOffers.$inferSelect;
export type NewVMIPriceOffer = typeof sqliteVMIPriceOffers.$inferInsert;
export type VMIOrder = typeof sqliteVMIOrders.$inferSelect;
export type NewVMIOrder = typeof sqliteVMIOrders.$inferInsert;
export type VMIOrderLine = typeof sqliteVMIOrderLines.$inferSelect;
export type NewVMIOrderLine = typeof sqliteVMIOrderLines.$inferInsert;
export type VMITransaction = typeof sqliteVMITransactions.$inferSelect;
export type NewVMITransaction = typeof sqliteVMITransactions.$inferInsert;

// HR/Personnel Management Types
export type HROrgUnit = typeof sqliteHROrgUnits.$inferSelect;
export type NewHROrgUnit = typeof sqliteHROrgUnits.$inferInsert;
export type HRPosition = typeof sqliteHRPositions.$inferSelect;
export type NewHRPosition = typeof sqliteHRPositions.$inferInsert;
export type HRJobDescription = typeof sqliteHRJobDescriptions.$inferSelect;
export type NewHRJobDescription = typeof sqliteHRJobDescriptions.$inferInsert;
export type HREmployee = typeof sqliteHREmployees.$inferSelect;
export type NewHREmployee = typeof sqliteHREmployees.$inferInsert;
export type HREmployeeAssignment = typeof sqliteHREmployeeAssignments.$inferSelect;
export type NewHREmployeeAssignment = typeof sqliteHREmployeeAssignments.$inferInsert;
export type HRTrainingCourse = typeof sqliteHRTrainingCourses.$inferSelect;
export type NewHRTrainingCourse = typeof sqliteHRTrainingCourses.$inferInsert;
export type HRTrainingSession = typeof sqliteHRTrainingSessions.$inferSelect;
export type NewHRTrainingSession = typeof sqliteHRTrainingSessions.$inferInsert;
export type HRTrainingRecord = typeof sqliteHRTrainingRecords.$inferSelect;
export type NewHRTrainingRecord = typeof sqliteHRTrainingRecords.$inferInsert;
export type HRAuthorization = typeof sqliteHRAuthorizations.$inferSelect;
export type NewHRAuthorization = typeof sqliteHRAuthorizations.$inferInsert;
export type HRDelegation = typeof sqliteHRDelegations.$inferSelect;
export type NewHRDelegation = typeof sqliteHRDelegations.$inferInsert;
export type HRHealthRecord = typeof sqliteHRHealthRecords.$inferSelect;
export type NewHRHealthRecord = typeof sqliteHRHealthRecords.$inferInsert;
export type HRAppRole = typeof sqliteHRAppRoles.$inferSelect;
export type NewHRAppRole = typeof sqliteHRAppRoles.$inferInsert;
export type HRAppPermission = typeof sqliteHRAppPermissions.$inferSelect;
export type NewHRAppPermission = typeof sqliteHRAppPermissions.$inferInsert;
export type HRRolePermission = typeof sqliteHRRolePermissions.$inferSelect;
export type NewHRRolePermission = typeof sqliteHRRolePermissions.$inferInsert;
export type HREmployeeRole = typeof sqliteHREmployeeRoles.$inferSelect;
export type NewHREmployeeRole = typeof sqliteHREmployeeRoles.$inferInsert;
export type HRNotification = typeof sqliteHRNotifications.$inferSelect;
export type NewHRNotification = typeof sqliteHRNotifications.$inferInsert;
export type HRAuditLogEntry = typeof sqliteHRAuditLog.$inferSelect;
export type NewHRAuditLogEntry = typeof sqliteHRAuditLog.$inferInsert;

// VMI Portal Integration Types (008-vmi-vendor-sync)
export type VmiPortalConfig = typeof sqliteVmiPortalConfig.$inferSelect;
export type NewVmiPortalConfig = typeof sqliteVmiPortalConfig.$inferInsert;
export type VmiSyncHistory = typeof sqliteVmiSyncHistory.$inferSelect;
export type NewVmiSyncHistory = typeof sqliteVmiSyncHistory.$inferInsert;
export type VmiSalesOrder = typeof sqliteVmiSalesOrders.$inferSelect;
export type NewVmiSalesOrder = typeof sqliteVmiSalesOrders.$inferInsert;
export type VmiSalesOrderLine = typeof sqliteVmiSalesOrderLines.$inferSelect;
export type NewVmiSalesOrderLine = typeof sqliteVmiSalesOrderLines.$inferInsert;

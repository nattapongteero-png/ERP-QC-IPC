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
  isLotControlled: integer('is_lot_controlled', { mode: 'boolean' }).notNull().default(true),
  isFEFO: integer('is_fefo', { mode: 'boolean' }).notNull().default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
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
  transactionType: text('transaction_type').notNull(), // inventory_snapshot, consumption, replenishment, asn
  itemId: integer('item_id').references(() => sqliteItems.id),
  quantity: real('quantity'),
  unit: text('unit'),
  data: text('data'), // JSON string for additional data
  status: text('status').notNull().default('pending'), // pending, sent, received, processed, error
  sentAt: text('sent_at'),
  receivedAt: text('received_at'),
  errorMessage: text('error_message'),
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
  isLotControlled: mysqlBoolean('is_lot_controlled').notNull().default(true),
  isFEFO: mysqlBoolean('is_fefo').notNull().default(true),
  isActive: mysqlBoolean('is_active').notNull().default(true),
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
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  itemId: int('item_id').references(() => mysqlItems.id),
  quantity: decimal('quantity', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 50 }),
  data: mysqlText('data'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  sentAt: datetime('sent_at'),
  receivedAt: datetime('received_at'),
  errorMessage: mysqlText('error_message'),
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

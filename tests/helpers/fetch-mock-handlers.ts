/**
 * Fetch Mock Handlers
 * Feature: 014-unit-cost
 *
 * Pre-built mock data and handlers for common API endpoints.
 * Use with createFetchMock() from ui-test-utils.tsx
 */

import { createPaginatedResponse, createSingleResponse, FetchMockConfig } from './ui-test-utils';
import { TEST_USER_IDS, TEST_PRODUCT_IDS, TEST_LOT_IDS, TEST_DATES } from './test-constants';

// ============================================
// Mock Data: Vendors
// ============================================

export const MOCK_VENDORS = [
  { id: 1, code: 'V001', name: 'Vendor Alpha', contactPerson: 'John Doe', phone: '0812345678', email: 'alpha@vendor.com', isApproved: true, isVMI: false },
  { id: 2, code: 'V002', name: 'Vendor Beta', contactPerson: 'Jane Smith', phone: '0823456789', email: 'beta@vendor.com', isApproved: true, isVMI: true },
  { id: 3, code: 'V003', name: 'Vendor Gamma', contactPerson: 'Bob Wilson', phone: '0834567890', email: 'gamma@vendor.com', isApproved: false, isVMI: false },
];

// ============================================
// Mock Data: Purchase Orders
// ============================================

export const MOCK_PURCHASE_ORDERS = [
  { id: 1, poNumber: 'PO2026-0001', vendorId: 1, vendorName: 'Vendor Alpha', status: 'draft', totalAmount: 50000, currency: 'THB', orderDate: TEST_DATES.TODAY },
  { id: 2, poNumber: 'PO2026-0002', vendorId: 2, vendorName: 'Vendor Beta', status: 'approved', totalAmount: 75000, currency: 'THB', orderDate: TEST_DATES.TODAY },
  { id: 3, poNumber: 'PO2026-0003', vendorId: 1, vendorName: 'Vendor Alpha', status: 'received', totalAmount: 100000, currency: 'THB', orderDate: TEST_DATES.PAST_DATE },
  { id: 4, poNumber: 'PO2026-0004', vendorId: 3, vendorName: 'Vendor Gamma', status: 'received', totalAmount: 25000, currency: 'THB', orderDate: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: Items/Products
// ============================================

export const MOCK_ITEMS = [
  { id: TEST_PRODUCT_IDS.PRODUCT_A, code: 'PROD-001', name: 'Herbal Extract A', category: 'Finished Good', unit: 'bottle', reorderPoint: 100, standardCost: 150 },
  { id: TEST_PRODUCT_IDS.PRODUCT_B, code: 'PROD-002', name: 'Herbal Extract B', category: 'Finished Good', unit: 'bottle', reorderPoint: 50, standardCost: 200 },
  { id: TEST_PRODUCT_IDS.RAW_MATERIAL, code: 'RAW-001', name: 'Raw Herb Material', category: 'Raw Material', unit: 'kg', reorderPoint: 500, standardCost: 50 },
  { id: 4, code: 'RAW-002', name: 'Packaging Material', category: 'Packaging', unit: 'pcs', reorderPoint: 1000, standardCost: 5 },
];

// ============================================
// Mock Data: Inventory Lots
// ============================================

export const MOCK_LOTS = [
  { id: TEST_LOT_IDS.LOT_A, lotNumber: 'LOT-2026-001', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemName: 'Herbal Extract A', quantity: 500, status: 'available', expiryDate: TEST_DATES.FUTURE_DATE },
  { id: TEST_LOT_IDS.LOT_B, lotNumber: 'LOT-2026-002', itemId: TEST_PRODUCT_IDS.PRODUCT_B, itemName: 'Herbal Extract B', quantity: 250, status: 'available', expiryDate: TEST_DATES.FUTURE_DATE },
  { id: TEST_LOT_IDS.LOT_QUARANTINE, lotNumber: 'LOT-2026-003', itemId: TEST_PRODUCT_IDS.RAW_MATERIAL, itemName: 'Raw Herb Material', quantity: 100, status: 'quarantine', expiryDate: TEST_DATES.NEAR_FUTURE },
];

// ============================================
// Mock Data: Employees
// ============================================

export const MOCK_EMPLOYEES = [
  { id: TEST_USER_IDS.QA_MANAGER, employeeCode: 'EMP001', name: 'QA Manager', email: 'qa@test.com', department: 'Quality Assurance', position: 'Manager', status: 'active' },
  { id: TEST_USER_IDS.PRODUCTION_SUPERVISOR, employeeCode: 'EMP002', name: 'Production Supervisor', email: 'prod@test.com', department: 'Production', position: 'Supervisor', status: 'active' },
  { id: TEST_USER_IDS.QC_ANALYST, employeeCode: 'EMP003', name: 'QC Analyst', email: 'qc@test.com', department: 'Quality Control', position: 'Analyst', status: 'active' },
  { id: TEST_USER_IDS.DOCUMENT_CONTROLLER, employeeCode: 'EMP004', name: 'Document Controller', email: 'doc@test.com', department: 'Quality Assurance', position: 'Controller', status: 'active' },
  { id: TEST_USER_IDS.AUDITOR, employeeCode: 'EMP005', name: 'Internal Auditor', email: 'audit@test.com', department: 'Quality Assurance', position: 'Auditor', status: 'active' },
];

// ============================================
// Mock Data: Customers
// ============================================

export const MOCK_CUSTOMERS = [
  { id: 1, code: 'C001', name: 'Customer Alpha', contactPerson: 'Alice Brown', phone: '0811111111', email: 'alpha@customer.com', creditLimit: 500000 },
  { id: 2, code: 'C002', name: 'Customer Beta', contactPerson: 'Charlie Davis', phone: '0822222222', email: 'beta@customer.com', creditLimit: 1000000 },
  { id: 3, code: 'C003', name: 'Customer Gamma', contactPerson: 'Diana Evans', phone: '0833333333', email: 'gamma@customer.com', creditLimit: 250000 },
];

// ============================================
// Mock Data: Work Orders
// ============================================

export const MOCK_WORK_ORDERS = [
  { id: 1, woNumber: 'WO2026-0001', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemName: 'Herbal Extract A', quantity: 100, status: 'draft', startDate: TEST_DATES.TODAY },
  { id: 2, woNumber: 'WO2026-0002', itemId: TEST_PRODUCT_IDS.PRODUCT_B, itemName: 'Herbal Extract B', quantity: 50, status: 'in_progress', startDate: TEST_DATES.TODAY },
  { id: 3, woNumber: 'WO2026-0003', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemName: 'Herbal Extract A', quantity: 200, status: 'completed', startDate: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: BOMs (Bill of Materials)
// ============================================

export const MOCK_BOMS = [
  { id: 1, bomNumber: 'BOM-001', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemName: 'Herbal Extract A', version: '1.0', status: 'active', effectiveDate: TEST_DATES.PAST_DATE },
  { id: 2, bomNumber: 'BOM-002', itemId: TEST_PRODUCT_IDS.PRODUCT_B, itemName: 'Herbal Extract B', version: '1.0', status: 'active', effectiveDate: TEST_DATES.PAST_DATE },
  { id: 3, bomNumber: 'BOM-003', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemName: 'Herbal Extract A', version: '2.0', status: 'draft', effectiveDate: TEST_DATES.FUTURE_DATE },
];

// ============================================
// Mock Data: Landed Costs
// ============================================

export const MOCK_LANDED_COSTS = [
  { id: 1, documentNumber: 'LC2026-00001', referenceType: 'po', referenceId: 3, referenceNumber: 'PO2026-0003', vendorId: 1, status: 'draft', totalAmount: 5000, currency: 'THB' },
  { id: 2, documentNumber: 'LC2026-00002', referenceType: 'po', referenceId: 4, referenceNumber: 'PO2026-0004', vendorId: 3, status: 'allocated', totalAmount: 3000, currency: 'THB' },
  { id: 3, documentNumber: 'LC2026-00003', referenceType: 'po', referenceId: 3, referenceNumber: 'PO2026-0003', vendorId: 1, status: 'posted', totalAmount: 7500, currency: 'THB' },
];

// ============================================
// Mock Data: Work Centers
// ============================================

export const MOCK_WORK_CENTERS = [
  { id: 1, code: 'WC001', name: 'Mixing Station 1', department: 'Production', hourlyRate: 500, setupTime: 30, status: 'active' },
  { id: 2, code: 'WC002', name: 'Filling Line A', department: 'Production', hourlyRate: 750, setupTime: 45, status: 'active' },
  { id: 3, code: 'WC003', name: 'Packaging Station', department: 'Packaging', hourlyRate: 400, setupTime: 15, status: 'active' },
];

// ============================================
// Mock Data: GL Accounts
// ============================================

export const MOCK_GL_ACCOUNTS = [
  { id: 1, accountCode: '1100', name: 'Cash', accountType: 'Asset', balance: 1000000 },
  { id: 2, accountCode: '1200', name: 'Accounts Receivable', accountType: 'Asset', balance: 500000 },
  { id: 3, accountCode: '2100', name: 'Accounts Payable', accountType: 'Liability', balance: 300000 },
  { id: 4, accountCode: '4100', name: 'Sales Revenue', accountType: 'Revenue', balance: 2000000 },
  { id: 5, accountCode: '5100', name: 'Cost of Goods Sold', accountType: 'Expense', balance: 1200000 },
];

// ============================================
// Mock Data: Sales Orders
// ============================================

export const MOCK_SALES_ORDERS = [
  { id: 1, soNumber: 'SO2026-0001', customerId: 1, customerName: 'Customer Alpha', status: 'draft', totalAmount: 150000, currency: 'THB', orderDate: TEST_DATES.TODAY },
  { id: 2, soNumber: 'SO2026-0002', customerId: 2, customerName: 'Customer Beta', status: 'confirmed', totalAmount: 250000, currency: 'THB', orderDate: TEST_DATES.TODAY },
  { id: 3, soNumber: 'SO2026-0003', customerId: 1, customerName: 'Customer Alpha', status: 'shipped', totalAmount: 100000, currency: 'THB', orderDate: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: GMP - CAPA
// ============================================

export const MOCK_CAPAS = [
  { id: 1, capaNumber: 'CAPA-2026-001', title: 'Deviation in Mixing Process', sourceType: 'deviation', type: 'corrective', status: 'open', priority: 'high', ownerId: TEST_USER_IDS.QA_MANAGER },
  { id: 2, capaNumber: 'CAPA-2026-002', title: 'Preventive Maintenance Review', sourceType: 'audit', type: 'preventive', status: 'investigation', priority: 'medium', ownerId: TEST_USER_IDS.QA_MANAGER },
  { id: 3, capaNumber: 'CAPA-2026-003', title: 'Packaging Error', sourceType: 'complaint', type: 'corrective', status: 'closed', priority: 'low', ownerId: TEST_USER_IDS.PRODUCTION_SUPERVISOR },
];

// ============================================
// Mock Data: GMP - Complaints
// ============================================

export const MOCK_COMPLAINTS = [
  { id: 1, complaintNumber: 'COMP-2026-001', customerName: 'Customer Alpha', productId: TEST_PRODUCT_IDS.PRODUCT_A, category: 'quality', severity: 'major', status: 'received', receivedDate: TEST_DATES.TODAY },
  { id: 2, complaintNumber: 'COMP-2026-002', customerName: 'Customer Beta', productId: TEST_PRODUCT_IDS.PRODUCT_B, category: 'packaging', severity: 'minor', status: 'under_investigation', receivedDate: TEST_DATES.PAST_DATE },
  { id: 3, complaintNumber: 'COMP-2026-003', customerName: 'Customer Gamma', productId: TEST_PRODUCT_IDS.PRODUCT_A, category: 'labeling', severity: 'critical', status: 'closed', receivedDate: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: GMP - Documents
// ============================================

export const MOCK_DOCUMENTS = [
  { id: 1, documentNumber: 'SOP-001', title: 'Standard Operating Procedure - Mixing', typeCode: 'SOP', version: '1.0', status: 'approved', effectiveDate: TEST_DATES.PAST_DATE },
  { id: 2, documentNumber: 'SOP-002', title: 'Standard Operating Procedure - Packaging', typeCode: 'SOP', version: '2.0', status: 'pending_approval', effectiveDate: TEST_DATES.FUTURE_DATE },
  { id: 3, documentNumber: 'POL-001', title: 'Quality Policy', typeCode: 'POL', version: '1.0', status: 'published', effectiveDate: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: Deviations
// ============================================

export const MOCK_DEVIATIONS = [
  { id: 1, deviationNumber: 'DEV-2026-001', title: 'Temperature Excursion', category: 'process', severity: 'major', status: 'open', reportedBy: TEST_USER_IDS.QC_ANALYST },
  { id: 2, deviationNumber: 'DEV-2026-002', title: 'Equipment Malfunction', category: 'equipment', severity: 'minor', status: 'closed', reportedBy: TEST_USER_IDS.PRODUCTION_SUPERVISOR },
];

// ============================================
// Mock Data: Positions
// ============================================

export const MOCK_POSITIONS = [
  { id: 1, code: 'POS001', name: 'QA Manager', department: 'Quality Assurance', level: 'Manager', status: 'active' },
  { id: 2, code: 'POS002', name: 'Production Supervisor', department: 'Production', level: 'Supervisor', status: 'active' },
  { id: 3, code: 'POS003', name: 'QC Analyst', department: 'Quality Control', level: 'Staff', status: 'active' },
];

// ============================================
// Mock Data: Training Courses
// ============================================

export const MOCK_TRAINING_COURSES = [
  { id: 1, code: 'GMP-101', name: 'GMP Fundamentals', category: 'Compliance', duration: 8, status: 'active' },
  { id: 2, code: 'QC-201', name: 'Quality Control Methods', category: 'Technical', duration: 16, status: 'active' },
  { id: 3, code: 'SAFE-101', name: 'Workplace Safety', category: 'Safety', duration: 4, status: 'active' },
];

// ============================================
// Pre-built Fetch Handler Configs
// ============================================

/**
 * Common handlers for most pages
 */
export const COMMON_FETCH_HANDLERS: FetchMockConfig = {
  '/api/vendors': { data: createPaginatedResponse(MOCK_VENDORS) },
  '/api/purchasing/orders': { data: createPaginatedResponse(MOCK_PURCHASE_ORDERS) },
  '/api/items': { data: createPaginatedResponse(MOCK_ITEMS) },
  '/api/inventory/lots': { data: createPaginatedResponse(MOCK_LOTS) },
  '/api/employees': { data: createPaginatedResponse(MOCK_EMPLOYEES) },
  '/api/customers': { data: createPaginatedResponse(MOCK_CUSTOMERS) },
};

/**
 * Handlers for Cost module
 */
export const COST_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/cost/landed-costs': { data: createPaginatedResponse(MOCK_LANDED_COSTS) },
  '/api/cost/work-centers': { data: createPaginatedResponse(MOCK_WORK_CENTERS) },
};

/**
 * Handlers for Production module
 */
export const PRODUCTION_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/production/work-orders': { data: createPaginatedResponse(MOCK_WORK_ORDERS) },
  '/api/production/bom': { data: createPaginatedResponse(MOCK_BOMS) },
};

/**
 * Handlers for GMP module
 */
export const GMP_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/gmp/capa': { data: createPaginatedResponse(MOCK_CAPAS) },
  '/api/gmp/complaints': { data: createPaginatedResponse(MOCK_COMPLAINTS) },
  '/api/gmp/documents': { data: createPaginatedResponse(MOCK_DOCUMENTS) },
  '/api/deviations': { data: createPaginatedResponse(MOCK_DEVIATIONS) },
};

/**
 * Handlers for HR module
 */
export const HR_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/hr/positions': { data: createPaginatedResponse(MOCK_POSITIONS) },
  '/api/hr/training/courses': { data: createPaginatedResponse(MOCK_TRAINING_COURSES) },
};

/**
 * Handlers for Accounting module
 */
export const ACCOUNTING_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/accounting/accounts': { data: createPaginatedResponse(MOCK_GL_ACCOUNTS) },
};

/**
 * Handlers for Sales module
 */
export const SALES_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/sales/orders': { data: createPaginatedResponse(MOCK_SALES_ORDERS) },
};

/**
 * All handlers combined
 */
export const ALL_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  ...COST_FETCH_HANDLERS,
  ...PRODUCTION_FETCH_HANDLERS,
  ...GMP_FETCH_HANDLERS,
  ...HR_FETCH_HANDLERS,
  ...ACCOUNTING_FETCH_HANDLERS,
  ...SALES_FETCH_HANDLERS,
};

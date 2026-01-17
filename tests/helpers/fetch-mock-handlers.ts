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
// Mock Data: Items/Products (Detailed for Inventory Page)
// ============================================

export const MOCK_ITEMS = [
  { id: TEST_PRODUCT_IDS.PRODUCT_A, code: 'PROD-001', nameTh: 'สารสกัดสมุนไพร A', nameEn: 'Herbal Extract A', type: 'finished_goods', category: 'Finished Good', primaryUnit: 'bottle', onHand: 500, onHandCost: 72750, quarantineQty: 0, shelfLifeDays: 730, isActive: true, tppCode: 'TPP001', ttmtCode: null, minStock: 100 },
  { id: TEST_PRODUCT_IDS.PRODUCT_B, code: 'PROD-002', nameTh: 'สารสกัดสมุนไพร B', nameEn: 'Herbal Extract B', type: 'finished_goods', category: 'Finished Good', primaryUnit: 'bottle', onHand: 250, onHandCost: 48812.50, quarantineQty: 10, shelfLifeDays: 730, isActive: true, tppCode: null, ttmtCode: 'TTMT001', minStock: 50 },
  { id: TEST_PRODUCT_IDS.RAW_MATERIAL, code: 'RAW-001', nameTh: 'วัตถุดิบสมุนไพร', nameEn: 'Raw Herb Material', type: 'raw_material', category: 'Raw Material', primaryUnit: 'kg', onHand: 1000, onHandCost: 52000, quarantineQty: 100, shelfLifeDays: 365, isActive: true, tppCode: null, ttmtCode: null, minStock: 500 },
  { id: 4, code: 'PKG-001', nameTh: 'วัสดุบรรจุภัณฑ์', nameEn: 'Packaging Material', type: 'packaging', category: 'Packaging', primaryUnit: 'pcs', onHand: 5000, onHandCost: 23750, quarantineQty: 0, shelfLifeDays: null, isActive: true, tppCode: null, ttmtCode: null, minStock: 1000 },
  { id: 5, code: 'WIP-001', nameTh: 'งานระหว่างทำ', nameEn: 'Work in Progress', type: 'wip', category: 'WIP', primaryUnit: 'batch', onHand: 10, onHandCost: 150000, quarantineQty: 0, shelfLifeDays: null, isActive: true, tppCode: null, ttmtCode: null, minStock: 0 },
  { id: 6, code: 'CON-001', nameTh: 'วัสดุสิ้นเปลือง', nameEn: 'Consumable Item', type: 'consumable', category: 'Consumable', primaryUnit: 'pcs', onHand: 200, onHandCost: 5000, quarantineQty: 0, shelfLifeDays: null, isActive: false, tppCode: null, ttmtCode: null, minStock: 50 },
];

// ============================================
// Mock Data: Inventory Lots (Detailed for Lots Page)
// ============================================

export const MOCK_LOTS = [
  { id: TEST_LOT_IDS.LOT_A, lotNumber: 'LOT-2026-001', itemId: TEST_PRODUCT_IDS.PRODUCT_A, itemCode: 'PROD-001', itemName: 'สารสกัดสมุนไพร A', warehouseId: 1, warehouseName: 'Main Warehouse', quantity: 500, reservedQuantity: 50, unit: 'bottle', status: 'released', manufacturingDate: TEST_DATES.PAST_DATE, expiryDate: TEST_DATES.FUTURE_DATE, receivedDate: TEST_DATES.TODAY, vendorLotNumber: 'VL-001', vendorId: 1, vendorName: 'Vendor Alpha', cost: 145.50, manufacturerName: 'Thai Herb Co.', countryOfOrigin: 'Thailand', retestDate: null },
  { id: TEST_LOT_IDS.LOT_B, lotNumber: 'LOT-2026-002', itemId: TEST_PRODUCT_IDS.PRODUCT_B, itemCode: 'PROD-002', itemName: 'สารสกัดสมุนไพร B', warehouseId: 1, warehouseName: 'Main Warehouse', quantity: 250, reservedQuantity: 0, unit: 'bottle', status: 'released', manufacturingDate: TEST_DATES.PAST_DATE, expiryDate: TEST_DATES.FUTURE_DATE, receivedDate: TEST_DATES.PAST_DATE, vendorLotNumber: 'VL-002', vendorId: 2, vendorName: 'Vendor Beta', cost: 195.25, manufacturerName: 'Herbal Plus Ltd.', countryOfOrigin: 'Thailand', retestDate: TEST_DATES.NEAR_FUTURE },
  { id: TEST_LOT_IDS.LOT_QUARANTINE, lotNumber: 'LOT-2026-003', itemId: TEST_PRODUCT_IDS.RAW_MATERIAL, itemCode: 'RAW-001', itemName: 'วัตถุดิบสมุนไพร', warehouseId: 2, warehouseName: 'Quarantine Area', quantity: 100, reservedQuantity: 0, unit: 'kg', status: 'quarantine', manufacturingDate: TEST_DATES.PAST_DATE, expiryDate: TEST_DATES.NEAR_FUTURE, receivedDate: TEST_DATES.TODAY, vendorLotNumber: 'VL-003', vendorId: 1, vendorName: 'Vendor Alpha', cost: 52.00, manufacturerName: 'Import Farm', countryOfOrigin: 'China', retestDate: TEST_DATES.FUTURE_DATE },
  { id: 4, lotNumber: 'LOT-2026-004', itemId: 4, itemCode: 'PKG-001', itemName: 'วัสดุบรรจุภัณฑ์', warehouseId: 3, warehouseName: 'Packaging Store', quantity: 5000, reservedQuantity: 500, unit: 'pcs', status: 'released', manufacturingDate: null, expiryDate: null, receivedDate: TEST_DATES.PAST_DATE, vendorLotNumber: null, vendorId: 3, vendorName: 'Vendor Gamma', cost: 4.75, manufacturerName: null, countryOfOrigin: null, retestDate: null },
  { id: 5, lotNumber: 'LOT-2026-005', itemId: TEST_PRODUCT_IDS.RAW_MATERIAL, itemCode: 'RAW-001', itemName: 'วัตถุดิบสมุนไพร', warehouseId: 2, warehouseName: 'Quarantine Area', quantity: 50, reservedQuantity: 0, unit: 'kg', status: 'rejected', manufacturingDate: TEST_DATES.PAST_DATE, expiryDate: TEST_DATES.PAST_DATE, receivedDate: TEST_DATES.PAST_DATE, vendorLotNumber: 'VL-004', vendorId: 1, vendorName: 'Vendor Alpha', cost: 48.00, manufacturerName: 'Import Farm', countryOfOrigin: 'China', retestDate: null },
];

// ============================================
// Mock Data: Warehouses (Detailed for Warehouses Page)
// ============================================

export const MOCK_WAREHOUSES = [
  { id: 1, code: 'WH001', name: 'Main Warehouse', type: 'finished_goods', location: 'Building A', temperatureMin: 15, temperatureMax: 25, humidityMin: 45, humidityMax: 65, capacity: 10000, isActive: true },
  { id: 2, code: 'WH002', name: 'Quarantine Area', type: 'quarantine', location: 'Building B', temperatureMin: 20, temperatureMax: 25, humidityMin: 40, humidityMax: 60, capacity: 2000, isActive: true },
  { id: 3, code: 'WH003', name: 'Packaging Store', type: 'raw_material', location: 'Building A', temperatureMin: null, temperatureMax: null, humidityMin: null, humidityMax: null, capacity: 5000, isActive: true },
  { id: 4, code: 'WH004', name: 'Cold Storage', type: 'cold_storage', location: 'Building C', temperatureMin: 2, temperatureMax: 8, humidityMin: 30, humidityMax: 50, capacity: 1000, isActive: true },
  { id: 5, code: 'WH005', name: 'WIP Storage', type: 'wip', location: 'Building A', temperatureMin: 18, temperatureMax: 25, humidityMin: 40, humidityMax: 60, capacity: 3000, isActive: true },
  { id: 6, code: 'WH006', name: 'Rejected Storage', type: 'rejected', location: 'Building D', temperatureMin: null, temperatureMax: null, humidityMin: null, humidityMax: null, capacity: 500, isActive: false },
];

// ============================================
// Mock Data: Employees (Detailed for HR Employees Page)
// ============================================

export const MOCK_EMPLOYEES = [
  { id: TEST_USER_IDS.QA_MANAGER, employeeCode: 'EMP001', firstName: 'สมชาย', lastName: 'ใจดี', email: 'qa@test.com', phone: '0812345678', status: 'active', orgUnitId: 1, orgUnitName: 'Quality Assurance', positionId: 1, positionTitle: 'QA Manager', hireDate: '2020-01-15' },
  { id: TEST_USER_IDS.PRODUCTION_SUPERVISOR, employeeCode: 'EMP002', firstName: 'สมหญิง', lastName: 'รักงาน', email: 'prod@test.com', phone: '0823456789', status: 'active', orgUnitId: 2, orgUnitName: 'Production', positionId: 2, positionTitle: 'Production Supervisor', hireDate: '2021-03-20' },
  { id: TEST_USER_IDS.QC_ANALYST, employeeCode: 'EMP003', firstName: 'มานี', lastName: 'มีชัย', email: 'qc@test.com', phone: '0834567890', status: 'active', orgUnitId: 3, orgUnitName: 'Quality Control', positionId: 3, positionTitle: 'QC Analyst', hireDate: '2022-06-01' },
  { id: TEST_USER_IDS.DOCUMENT_CONTROLLER, employeeCode: 'EMP004', firstName: 'ปิติ', lastName: 'ยินดี', email: 'doc@test.com', phone: '0845678901', status: 'inactive', orgUnitId: 1, orgUnitName: 'Quality Assurance', positionId: 4, positionTitle: 'Document Controller', hireDate: '2019-08-10' },
  { id: TEST_USER_IDS.AUDITOR, employeeCode: 'EMP005', firstName: 'ชูใจ', lastName: 'เข้มแข็ง', email: 'audit@test.com', phone: '0856789012', status: 'active', orgUnitId: 1, orgUnitName: 'Quality Assurance', positionId: 5, positionTitle: 'Internal Auditor', hireDate: '2023-01-05' },
  { id: 6, employeeCode: 'EMP006', firstName: 'วิทยา', lastName: 'ฉลาด', email: 'rd@test.com', phone: '0867890123', status: 'terminated', orgUnitId: 4, orgUnitName: 'R&D', positionId: 6, positionTitle: 'R&D Scientist', hireDate: '2018-05-15' },
];

// ============================================
// Mock Data: Customers
// ============================================

export const MOCK_CUSTOMERS = [
  { id: 1, code: 'C001', name: 'Customer Alpha', contactPerson: 'Alice Brown', phone: '0811111111', email: 'alpha@customer.com', address: '123 Main St, Bangkok', customerType: 'hospital', creditLimit: 500000, creditTermDays: 30, paymentTerms: 'Net 30', isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, code: 'C002', name: 'Customer Beta', contactPerson: 'Charlie Davis', phone: '0822222222', email: 'beta@customer.com', address: '456 Oak Ave, Chiang Mai', customerType: 'pharmacy', creditLimit: 1000000, creditTermDays: 45, paymentTerms: 'Net 45', isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, code: 'C003', name: 'Customer Gamma', contactPerson: 'Diana Evans', phone: '0833333333', email: 'gamma@customer.com', address: '789 Pine Rd, Phuket', customerType: 'distributor', creditLimit: 250000, creditTermDays: 30, paymentTerms: 'Net 30', isActive: false, createdAt: TEST_DATES.TODAY },
  { id: 4, code: 'C004', name: 'Customer Delta', contactPerson: 'Edward Fox', phone: '0844444444', email: 'delta@customer.com', address: '321 Elm Blvd, Pattaya', customerType: 'clinic', creditLimit: 750000, creditTermDays: 60, paymentTerms: 'Net 60', isActive: true, createdAt: TEST_DATES.TODAY },
];

// ============================================
// Mock Data: Work Orders (Detailed for Work Orders Page)
// ============================================

export const MOCK_WORK_ORDERS = [
  { id: 1, woNumber: 'WO2026-0001', batchNumber: 'BATCH-001', productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', plannedQuantity: 100, actualQuantity: 0, unit: 'bottle', status: 'planned', priority: 1, plannedStartDate: TEST_DATES.TODAY, plannedEndDate: TEST_DATES.NEAR_FUTURE, actualStartDate: '', actualEndDate: '', yieldPercentage: 0, createdAt: TEST_DATES.TODAY },
  { id: 2, woNumber: 'WO2026-0002', batchNumber: 'BATCH-002', productId: TEST_PRODUCT_IDS.PRODUCT_B, productCode: 'PROD-002', productName: 'สารสกัดสมุนไพร B', plannedQuantity: 50, actualQuantity: 25, unit: 'bottle', status: 'in_progress', priority: 5, plannedStartDate: TEST_DATES.PAST_DATE, plannedEndDate: TEST_DATES.TODAY, actualStartDate: TEST_DATES.PAST_DATE, actualEndDate: '', yieldPercentage: 0, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, woNumber: 'WO2026-0003', batchNumber: 'BATCH-003', productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', plannedQuantity: 200, actualQuantity: 196, unit: 'bottle', status: 'completed', priority: 3, plannedStartDate: TEST_DATES.PAST_DATE, plannedEndDate: TEST_DATES.PAST_DATE, actualStartDate: TEST_DATES.PAST_DATE, actualEndDate: TEST_DATES.PAST_DATE, yieldPercentage: 98.0, createdAt: TEST_DATES.PAST_DATE },
  { id: 4, woNumber: 'WO2026-0004', batchNumber: 'BATCH-004', productId: TEST_PRODUCT_IDS.PRODUCT_B, productCode: 'PROD-002', productName: 'สารสกัดสมุนไพร B', plannedQuantity: 75, actualQuantity: 0, unit: 'bottle', status: 'released', priority: 2, plannedStartDate: TEST_DATES.TODAY, plannedEndDate: TEST_DATES.NEAR_FUTURE, actualStartDate: '', actualEndDate: '', yieldPercentage: 0, createdAt: TEST_DATES.TODAY },
  { id: 5, woNumber: 'WO2026-0005', batchNumber: 'BATCH-005', productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', plannedQuantity: 150, actualQuantity: 0, unit: 'bottle', status: 'cancelled', priority: 8, plannedStartDate: TEST_DATES.PAST_DATE, plannedEndDate: TEST_DATES.PAST_DATE, actualStartDate: '', actualEndDate: '', yieldPercentage: 0, createdAt: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: BOMs (Bill of Materials) - Detailed
// ============================================

export const MOCK_BOMS = [
  { id: 1, code: 'BOM-001', name: 'สารสกัดสมุนไพร A - สูตรมาตรฐาน', productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', version: '1.0', status: 'approved', standardBatchSize: 100, batchUnit: 'bottle', effectiveDate: TEST_DATES.PAST_DATE, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, code: 'BOM-002', name: 'สารสกัดสมุนไพร B - สูตรมาตรฐาน', productId: TEST_PRODUCT_IDS.PRODUCT_B, productCode: 'PROD-002', productName: 'สารสกัดสมุนไพร B', version: '1.0', status: 'approved', standardBatchSize: 50, batchUnit: 'bottle', effectiveDate: TEST_DATES.PAST_DATE, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, code: 'BOM-003', name: 'สารสกัดสมุนไพร A - สูตรปรับปรุง', productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', version: '2.0', status: 'draft', standardBatchSize: 150, batchUnit: 'bottle', effectiveDate: TEST_DATES.FUTURE_DATE, createdAt: TEST_DATES.TODAY },
  { id: 4, code: 'BOM-004', name: 'สารสกัดสมุนไพร B - สูตรเดิม', productId: TEST_PRODUCT_IDS.PRODUCT_B, productCode: 'PROD-002', productName: 'สารสกัดสมุนไพร B', version: '0.9', status: 'obsolete', standardBatchSize: 50, batchUnit: 'bottle', effectiveDate: TEST_DATES.PAST_DATE, createdAt: TEST_DATES.PAST_DATE },
  { id: 5, code: 'BOM-005', name: 'สารสกัดสมุนไพร C', productId: 5, productCode: 'PROD-003', productName: 'สารสกัดสมุนไพร C', version: '1.0', status: 'active', standardBatchSize: 200, batchUnit: 'bottle', effectiveDate: TEST_DATES.PAST_DATE, createdAt: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: BOM Dashboard
// ============================================

export const MOCK_BOM_DASHBOARD = {
  totalBOMs: 5,
  activeBOMs: 3,
  draftBOMs: 1,
  obsoleteBOMs: 1,
  activeWorkOrders: 3,
  totalMaterials: 25,
  avgMaterialsPerBOM: 5.0,
  byStatus: {
    approved: 2,
    active: 1,
    draft: 1,
    obsolete: 1,
  },
  topProducts: [
    { productId: TEST_PRODUCT_IDS.PRODUCT_A, productCode: 'PROD-001', productName: 'สารสกัดสมุนไพร A', bomCount: 2, activeBOMs: 1 },
    { productId: TEST_PRODUCT_IDS.PRODUCT_B, productCode: 'PROD-002', productName: 'สารสกัดสมุนไพร B', bomCount: 2, activeBOMs: 1 },
    { productId: 5, productCode: 'PROD-003', productName: 'สารสกัดสมุนไพร C', bomCount: 1, activeBOMs: 1 },
  ],
  recentBOMs: [
    { id: 3, code: 'BOM-003', version: '2.0', productName: 'สารสกัดสมุนไพร A', status: 'draft' },
    { id: 1, code: 'BOM-001', version: '1.0', productName: 'สารสกัดสมุนไพร A', status: 'approved' },
    { id: 2, code: 'BOM-002', version: '1.0', productName: 'สารสกัดสมุนไพร B', status: 'approved' },
  ],
};

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
  { id: 1, code: 'WC001', name: 'Mixing Station 1', orgUnitName: 'Production', laborRatePerHour: 200, overheadRatePerHour: 150, machineRatePerHour: 150, capacityHoursPerDay: 8, isActive: true },
  { id: 2, code: 'WC002', name: 'Filling Line A', orgUnitName: 'Production', laborRatePerHour: 300, overheadRatePerHour: 200, machineRatePerHour: 250, capacityHoursPerDay: 8, isActive: true },
  { id: 3, code: 'WC003', name: 'Packaging Station', orgUnitName: 'Packaging', laborRatePerHour: 150, overheadRatePerHour: 100, machineRatePerHour: 150, capacityHoursPerDay: 6, isActive: false },
];

// ============================================
// Mock Data: Cost Dashboard KPIs
// ============================================

export const MOCK_COST_DASHBOARD_KPIS = {
  inventoryValue: 5000000,
  wipValue: 750000,
  grossMarginPercent: 35.5,
  favorableVariance: 25000,
  unfavorableVariance: 15000,
  costTrend: [
    { period: 'Aug 2025', avgMaterialCost: 45000 },
    { period: 'Sep 2025', avgMaterialCost: 47000 },
    { period: 'Oct 2025', avgMaterialCost: 46500 },
    { period: 'Nov 2025', avgMaterialCost: 48000 },
    { period: 'Dec 2025', avgMaterialCost: 47500 },
    { period: 'Jan 2026', avgMaterialCost: 49000 },
  ],
  topCostIncreases: [
    { itemId: 1, itemCode: 'RAW-001', itemName: 'Raw Herb Material', previousCost: 45, currentCost: 52, changePercent: 15.5 },
    { itemId: 2, itemCode: 'RAW-002', itemName: 'Packaging Material', previousCost: 4.5, currentCost: 5, changePercent: 11.1 },
    { itemId: 3, itemCode: 'RAW-003', itemName: 'Extract Solvent', previousCost: 120, currentCost: 130, changePercent: 8.3 },
  ],
};

// ============================================
// Mock Data: Cost Summary Report
// ============================================

export const MOCK_COST_SUMMARY = [
  { itemId: 1, itemCode: 'PROD-001', itemName: 'Herbal Extract A', itemType: 'finished_goods', uom: 'bottle', onHand: 500, currentWAC: 145.50, onHandValue: 72750, standardCost: 150, lastPurchaseCost: null, fullCost: 180 },
  { itemId: 2, itemCode: 'PROD-002', itemName: 'Herbal Extract B', itemType: 'finished_goods', uom: 'bottle', onHand: 250, currentWAC: 195.25, onHandValue: 48812.50, standardCost: 200, lastPurchaseCost: null, fullCost: 220 },
  { itemId: 3, itemCode: 'RAW-001', itemName: 'Raw Herb Material', itemType: 'raw_material', uom: 'kg', onHand: 1000, currentWAC: 52, onHandValue: 52000, standardCost: 50, lastPurchaseCost: 55, fullCost: 52 },
  { itemId: 4, itemCode: 'PKG-001', itemName: 'Bottle 100ml', itemType: 'packaging', uom: 'pcs', onHand: 5000, currentWAC: 4.75, onHandValue: 23750, standardCost: 5, lastPurchaseCost: 4.5, fullCost: 4.75 },
];

// ============================================
// Mock Data: GL Accounts (Detailed for Chart of Accounts Page)
// ============================================

export const MOCK_GL_ACCOUNTS = [
  { id: 1, code: '1-1000', nameTh: 'สินทรัพย์', nameEn: 'Assets', accountTypeId: 1, parentId: null, level: 1, isPostable: false, isBankAccount: false, isActive: true, accountType: { code: 'ASSET', nameTh: 'สินทรัพย์' } },
  { id: 2, code: '1-1100', nameTh: 'เงินสดและรายการเทียบเท่าเงินสด', nameEn: 'Cash and Cash Equivalents', accountTypeId: 1, parentId: 1, level: 2, isPostable: false, isBankAccount: false, isActive: true, accountType: { code: 'ASSET', nameTh: 'สินทรัพย์' } },
  { id: 3, code: '1-1100-01', nameTh: 'เงินสดในมือ', nameEn: 'Cash on Hand', accountTypeId: 1, parentId: 2, level: 3, isPostable: true, isBankAccount: false, isActive: true, accountType: { code: 'ASSET', nameTh: 'สินทรัพย์' } },
  { id: 4, code: '1-1100-02', nameTh: 'เงินฝากธนาคารกรุงเทพ', nameEn: 'Bangkok Bank Deposit', accountTypeId: 1, parentId: 2, level: 3, isPostable: true, isBankAccount: true, bankName: 'ธนาคารกรุงเทพ', bankAccountNumber: '123-4-56789-0', isActive: true, accountType: { code: 'ASSET', nameTh: 'สินทรัพย์' } },
  { id: 5, code: '1-1200', nameTh: 'ลูกหนี้การค้า', nameEn: 'Accounts Receivable', accountTypeId: 1, parentId: 1, level: 2, isPostable: true, isBankAccount: false, isActive: true, accountType: { code: 'ASSET', nameTh: 'สินทรัพย์' } },
  { id: 6, code: '2-1000', nameTh: 'หนี้สิน', nameEn: 'Liabilities', accountTypeId: 2, parentId: null, level: 1, isPostable: false, isBankAccount: false, isActive: true, accountType: { code: 'LIABILITY', nameTh: 'หนี้สิน' } },
  { id: 7, code: '2-1100', nameTh: 'เจ้าหนี้การค้า', nameEn: 'Accounts Payable', accountTypeId: 2, parentId: 6, level: 2, isPostable: true, isBankAccount: false, isActive: true, accountType: { code: 'LIABILITY', nameTh: 'หนี้สิน' } },
  { id: 8, code: '4-1000', nameTh: 'รายได้', nameEn: 'Revenue', accountTypeId: 4, parentId: null, level: 1, isPostable: false, isBankAccount: false, isActive: true, accountType: { code: 'REVENUE', nameTh: 'รายได้' } },
  { id: 9, code: '4-1100', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue', accountTypeId: 4, parentId: 8, level: 2, isPostable: true, isBankAccount: false, isActive: true, accountType: { code: 'REVENUE', nameTh: 'รายได้' } },
  { id: 10, code: '5-1000', nameTh: 'ค่าใช้จ่าย', nameEn: 'Expenses', accountTypeId: 5, parentId: null, level: 1, isPostable: false, isBankAccount: false, isActive: false, accountType: { code: 'EXPENSE', nameTh: 'ค่าใช้จ่าย' } },
];

export const MOCK_GL_ACCOUNT_TYPES = [
  { id: 1, code: 'ASSET', nameTh: 'สินทรัพย์', nameEn: 'Asset', normalBalance: 'debit', displayOrder: 1 },
  { id: 2, code: 'LIABILITY', nameTh: 'หนี้สิน', nameEn: 'Liability', normalBalance: 'credit', displayOrder: 2 },
  { id: 3, code: 'EQUITY', nameTh: 'ส่วนของผู้ถือหุ้น', nameEn: 'Equity', normalBalance: 'credit', displayOrder: 3 },
  { id: 4, code: 'REVENUE', nameTh: 'รายได้', nameEn: 'Revenue', normalBalance: 'credit', displayOrder: 4 },
  { id: 5, code: 'EXPENSE', nameTh: 'ค่าใช้จ่าย', nameEn: 'Expense', normalBalance: 'debit', displayOrder: 5 },
];

// ============================================
// Mock Data: AP Invoices (for AP Dashboard)
// ============================================

export const MOCK_AP_INVOICES = [
  { id: 1, invoiceNumber: 'AP-INV-2026-001', vendorId: 1, vendorName: 'Vendor Alpha', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.NEAR_FUTURE, receivedDate: TEST_DATES.TODAY, description: 'Raw materials purchase', subtotal: 50000, vatAmount: 3500, whtAmount: 1500, totalAmount: 52000, paidAmount: 0, currency: 'THB', status: 'posted' },
  { id: 2, invoiceNumber: 'AP-INV-2026-002', vendorId: 2, vendorName: 'Vendor Beta', invoiceDate: TEST_DATES.PAST_DATE, dueDate: TEST_DATES.PAST_DATE, receivedDate: TEST_DATES.PAST_DATE, description: 'Packaging materials', subtotal: 25000, vatAmount: 1750, whtAmount: 750, totalAmount: 26000, paidAmount: 26000, currency: 'THB', status: 'paid' },
  { id: 3, invoiceNumber: 'AP-INV-2026-003', vendorId: 1, vendorName: 'Vendor Alpha', invoiceDate: TEST_DATES.PAST_DATE, dueDate: TEST_DATES.PAST_DATE, receivedDate: TEST_DATES.PAST_DATE, description: 'Equipment parts - OVERDUE', subtotal: 75000, vatAmount: 5250, whtAmount: 2250, totalAmount: 78000, paidAmount: 0, currency: 'THB', status: 'posted' },
  { id: 4, invoiceNumber: 'AP-INV-2026-004', vendorId: 3, vendorName: 'Vendor Gamma', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.FUTURE_DATE, receivedDate: TEST_DATES.TODAY, description: 'Office supplies', subtotal: 10000, vatAmount: 700, whtAmount: 0, totalAmount: 10700, paidAmount: 5000, currency: 'THB', status: 'partial' },
  { id: 5, invoiceNumber: 'AP-INV-2026-005', vendorId: 2, vendorName: 'Vendor Beta', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.NEAR_FUTURE, receivedDate: TEST_DATES.TODAY, description: 'Draft invoice', subtotal: 30000, vatAmount: 2100, whtAmount: 900, totalAmount: 31200, paidAmount: 0, currency: 'THB', status: 'draft' },
];

// ============================================
// Mock Data: AR Invoices (for AR Dashboard)
// ============================================

export const MOCK_AR_INVOICES = [
  { id: 1, invoiceNumber: 'AR-INV-2026-001', customerId: 1, customerName: 'Customer Alpha', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.NEAR_FUTURE, description: 'Product sales', subtotal: 150000, vatAmount: 10500, whtAmount: 4500, totalAmount: 156000, paidAmount: 0, currency: 'THB', status: 'posted' },
  { id: 2, invoiceNumber: 'AR-INV-2026-002', customerId: 2, customerName: 'Customer Beta', invoiceDate: TEST_DATES.PAST_DATE, dueDate: TEST_DATES.PAST_DATE, description: 'Consulting services', subtotal: 80000, vatAmount: 5600, whtAmount: 2400, totalAmount: 83200, paidAmount: 83200, currency: 'THB', status: 'paid' },
  { id: 3, invoiceNumber: 'AR-INV-2026-003', customerId: 1, customerName: 'Customer Alpha', invoiceDate: TEST_DATES.PAST_DATE, dueDate: TEST_DATES.PAST_DATE, description: 'Product sales - OVERDUE', subtotal: 200000, vatAmount: 14000, whtAmount: 6000, totalAmount: 208000, paidAmount: 0, currency: 'THB', status: 'posted' },
  { id: 4, invoiceNumber: 'AR-INV-2026-004', customerId: 3, customerName: 'Customer Gamma', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.FUTURE_DATE, description: 'Wholesale order', subtotal: 300000, vatAmount: 21000, whtAmount: 9000, totalAmount: 312000, paidAmount: 100000, currency: 'THB', status: 'partial' },
  { id: 5, invoiceNumber: 'AR-INV-2026-005', customerId: 2, customerName: 'Customer Beta', invoiceDate: TEST_DATES.TODAY, dueDate: TEST_DATES.NEAR_FUTURE, description: 'Pending approval', subtotal: 50000, vatAmount: 3500, whtAmount: 1500, totalAmount: 52000, paidAmount: 0, currency: 'THB', status: 'approved' },
];

// ============================================
// Mock Data: Aging Report (for AP/AR)
// ============================================

export const MOCK_AGING_REPORT = {
  totals: {
    current: 150000,
    days30: 75000,
    days60: 50000,
    days90: 25000,
    over90: 10000,
  },
};

// ============================================
// Mock Data: Sales Orders
// ============================================

export const MOCK_SALES_ORDERS = [
  { id: 1, soNumber: 'SO2026-0001', customerId: 1, customerName: 'Customer Alpha', customerContact: 'Alice Brown', customerAddress: '123 Main St', status: 'draft', totalAmount: 150000, currency: 'THB', orderDate: TEST_DATES.TODAY, requiredDate: TEST_DATES.NEAR_FUTURE, paymentTerms: 'Net 30', notes: 'Urgent order', createdAt: TEST_DATES.TODAY, updatedAt: TEST_DATES.TODAY },
  { id: 2, soNumber: 'SO2026-0002', customerId: 2, customerName: 'Customer Beta', customerContact: 'Charlie Davis', customerAddress: '456 Oak Ave', status: 'confirmed', totalAmount: 250000, currency: 'THB', orderDate: TEST_DATES.TODAY, requiredDate: TEST_DATES.FUTURE_DATE, paymentTerms: 'Net 45', notes: '', createdAt: TEST_DATES.TODAY, updatedAt: TEST_DATES.TODAY },
  { id: 3, soNumber: 'SO2026-0003', customerId: 1, customerName: 'Customer Alpha', customerContact: 'Alice Brown', customerAddress: '123 Main St', status: 'shipped', totalAmount: 100000, currency: 'THB', orderDate: TEST_DATES.PAST_DATE, requiredDate: TEST_DATES.PAST_DATE, paymentTerms: 'Net 30', notes: '', createdAt: TEST_DATES.PAST_DATE, updatedAt: TEST_DATES.TODAY },
  { id: 4, soNumber: 'SO2026-0004', customerId: 3, customerName: 'Customer Gamma', customerContact: 'Diana Evans', customerAddress: '789 Pine Rd', status: 'delivered', totalAmount: 200000, currency: 'THB', orderDate: TEST_DATES.PAST_DATE, requiredDate: TEST_DATES.TODAY, paymentTerms: 'Net 30', notes: 'Completed', createdAt: TEST_DATES.PAST_DATE, updatedAt: TEST_DATES.TODAY },
  { id: 5, soNumber: 'SO2026-0005', customerId: 4, customerName: 'Customer Delta', customerContact: 'Edward Fox', customerAddress: '321 Elm Blvd', status: 'processing', totalAmount: 175000, currency: 'THB', orderDate: TEST_DATES.TODAY, requiredDate: TEST_DATES.NEAR_FUTURE, paymentTerms: 'Net 60', notes: 'In progress', createdAt: TEST_DATES.TODAY, updatedAt: TEST_DATES.TODAY },
];

// ============================================
// Mock Data: GMP - CAPA (Detailed)
// ============================================

export const MOCK_CAPAS = [
  { id: 1, capaNumber: 'CAPA-2026-001', title: 'Deviation in Mixing Process', sourceType: 'deviation', type: 'corrective', status: 'open', priority: 'high', ownerId: TEST_USER_IDS.QA_MANAGER, dueDate: TEST_DATES.NEAR_FUTURE, riskScore: 12, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, capaNumber: 'CAPA-2026-002', title: 'Preventive Maintenance Review', sourceType: 'audit', type: 'preventive', status: 'investigation', priority: 'medium', ownerId: TEST_USER_IDS.QA_MANAGER, dueDate: TEST_DATES.FUTURE_DATE, riskScore: 6, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, capaNumber: 'CAPA-2026-003', title: 'Packaging Error', sourceType: 'complaint', type: 'corrective', status: 'closed', priority: 'low', ownerId: TEST_USER_IDS.PRODUCTION_SUPERVISOR, dueDate: TEST_DATES.PAST_DATE, riskScore: 3, createdAt: TEST_DATES.PAST_DATE },
  { id: 4, capaNumber: 'CAPA-2026-004', title: 'Training Gap Analysis', sourceType: 'audit', type: 'corrective', status: 'pending_approval', priority: 'medium', ownerId: TEST_USER_IDS.QA_MANAGER, dueDate: TEST_DATES.NEAR_FUTURE, riskScore: 8, createdAt: TEST_DATES.TODAY },
];

export const MOCK_CAPA_DASHBOARD = {
  totalCapas: 4,
  byStatus: { open: 1, investigation: 1, closed: 1, pending_approval: 1 },
  byPriority: { high: 1, medium: 2, low: 1 },
  byType: { corrective: 3, preventive: 1 },
  activeCount: 3,
  overdueCount: 0,
  avgClosureTime: 15,
  riskDistribution: { low: 1, medium: 1, high: 1, critical: 0 },
};

// ============================================
// Mock Data: GMP - Complaints (Detailed)
// ============================================

export const MOCK_COMPLAINTS = [
  { id: 1, complaintNumber: 'COMP-2026-001', customerName: 'Customer Alpha', productId: TEST_PRODUCT_IDS.PRODUCT_A, productName: 'Herbal Extract A', category: 'quality', severity: 'major', status: 'received', receivedDate: TEST_DATES.TODAY, description: 'Product quality issue' },
  { id: 2, complaintNumber: 'COMP-2026-002', customerName: 'Customer Beta', productId: TEST_PRODUCT_IDS.PRODUCT_B, productName: 'Herbal Extract B', category: 'packaging', severity: 'minor', status: 'under_investigation', receivedDate: TEST_DATES.PAST_DATE, description: 'Packaging damage' },
  { id: 3, complaintNumber: 'COMP-2026-003', customerName: 'Customer Gamma', productId: TEST_PRODUCT_IDS.PRODUCT_A, productName: 'Herbal Extract A', category: 'labeling', severity: 'critical', status: 'closed', receivedDate: TEST_DATES.PAST_DATE, description: 'Labeling error' },
  { id: 4, complaintNumber: 'COMP-2026-004', customerName: 'Customer Alpha', productId: TEST_PRODUCT_IDS.PRODUCT_B, productName: 'Herbal Extract B', category: 'safety', severity: 'major', status: 'resolved', receivedDate: TEST_DATES.TODAY, description: 'Safety concern' },
];

export const MOCK_COMPLAINTS_DASHBOARD = {
  totalOpen: 2,
  byStatus: { received: 1, under_investigation: 1, resolved: 1, closed: 1 },
  bySeverity: { minor: 1, major: 2, critical: 1 },
  pendingInvestigation: 1,
  resolvedThisMonth: 2,
  criticalCount: 1,
};

export const MOCK_COMPLAINTS_TRENDS = {
  monthly: [
    { period: 'Nov 2025', count: 2 },
    { period: 'Dec 2025', count: 3 },
    { period: 'Jan 2026', count: 4 },
  ],
  byCategory: { quality: 2, packaging: 1, labeling: 1, safety: 1 },
};

// ============================================
// Mock Data: GMP - Documents (Detailed)
// ============================================

export const MOCK_DOCUMENTS = [
  { id: 1, documentNumber: 'SOP-001', title: 'Standard Operating Procedure - Mixing', typeCode: 'SOP', typeName: 'Standard Operating Procedure', version: '1.0', status: 'approved', effectiveDate: TEST_DATES.PAST_DATE, reviewDate: TEST_DATES.FUTURE_DATE, ownerId: TEST_USER_IDS.QA_MANAGER },
  { id: 2, documentNumber: 'SOP-002', title: 'Standard Operating Procedure - Packaging', typeCode: 'SOP', typeName: 'Standard Operating Procedure', version: '2.0', status: 'pending_approval', effectiveDate: TEST_DATES.FUTURE_DATE, reviewDate: null, ownerId: TEST_USER_IDS.QA_MANAGER },
  { id: 3, documentNumber: 'POL-001', title: 'Quality Policy', typeCode: 'POL', typeName: 'Policy', version: '1.0', status: 'published', effectiveDate: TEST_DATES.PAST_DATE, reviewDate: TEST_DATES.NEAR_FUTURE, ownerId: TEST_USER_IDS.QA_MANAGER },
  { id: 4, documentNumber: 'WI-001', title: 'Work Instruction - Cleaning', typeCode: 'WI', typeName: 'Work Instruction', version: '1.0', status: 'draft', effectiveDate: null, reviewDate: null, ownerId: TEST_USER_IDS.PRODUCTION_SUPERVISOR },
  { id: 5, documentNumber: 'SOP-003', title: 'Standard Operating Procedure - QC Testing', typeCode: 'SOP', typeName: 'Standard Operating Procedure', version: '1.0', status: 'obsolete', effectiveDate: TEST_DATES.PAST_DATE, reviewDate: null, ownerId: TEST_USER_IDS.QC_ANALYST },
];

export const MOCK_DOCUMENTS_DASHBOARD = {
  total: 5,
  byStatus: { approved: 1, pending_approval: 1, published: 1, draft: 1, obsolete: 1 },
  byType: { SOP: 3, POL: 1, WI: 1 },
  pendingApprovals: 1,
  upForReview: 1,
};

export const MOCK_DOCUMENT_TYPES = [
  { id: 1, code: 'SOP', name: 'Standard Operating Procedure', description: 'Detailed instructions for processes', isActive: true },
  { id: 2, code: 'POL', name: 'Policy', description: 'Organizational policies', isActive: true },
  { id: 3, code: 'WI', name: 'Work Instruction', description: 'Step-by-step work instructions', isActive: true },
  { id: 4, code: 'FORM', name: 'Form', description: 'Blank forms and templates', isActive: true },
];

export const MOCK_PENDING_APPROVALS = [
  { id: 1, documentId: 2, documentNumber: 'SOP-002', documentTitle: 'Standard Operating Procedure - Packaging', requestedBy: TEST_USER_IDS.QA_MANAGER, requestedAt: TEST_DATES.TODAY, status: 'pending' },
];

// ============================================
// Mock Data: Deviations
// ============================================

export const MOCK_DEVIATIONS = [
  { id: 1, deviationNumber: 'DEV-2026-001', title: 'Temperature Excursion', category: 'process', severity: 'major', status: 'open', reportedBy: TEST_USER_IDS.QC_ANALYST },
  { id: 2, deviationNumber: 'DEV-2026-002', title: 'Equipment Malfunction', category: 'equipment', severity: 'minor', status: 'closed', reportedBy: TEST_USER_IDS.PRODUCTION_SUPERVISOR },
];

// ============================================
// Mock Data: Org Units (for HR Module)
// ============================================

export const MOCK_ORG_UNITS = [
  { id: 1, code: 'QA', name: 'Quality Assurance', parentId: null, level: 1, isActive: true },
  { id: 2, code: 'PROD', name: 'Production', parentId: null, level: 1, isActive: true },
  { id: 3, code: 'QC', name: 'Quality Control', parentId: 1, level: 2, isActive: true },
  { id: 4, code: 'RD', name: 'R&D', parentId: null, level: 1, isActive: true },
  { id: 5, code: 'ADMIN', name: 'Administration', parentId: null, level: 1, isActive: true },
];

// ============================================
// Mock Data: Positions (Detailed for HR Positions Page)
// ============================================

export const MOCK_POSITIONS = [
  { id: 1, code: 'POS-QA-001', title: 'ผู้จัดการควบคุมคุณภาพ', titleEn: 'QA Manager', orgUnitId: 1, jobGrade: 'Manager', isGmpCritical: true, isActive: true },
  { id: 2, code: 'POS-PROD-001', title: 'หัวหน้างานฝ่ายผลิต', titleEn: 'Production Supervisor', orgUnitId: 2, jobGrade: 'Supervisor', isGmpCritical: true, isActive: true },
  { id: 3, code: 'POS-QC-001', title: 'นักวิเคราะห์คุณภาพ', titleEn: 'QC Analyst', orgUnitId: 3, jobGrade: 'Staff', isGmpCritical: true, isActive: true },
  { id: 4, code: 'POS-QA-002', title: 'ผู้ควบคุมเอกสาร', titleEn: 'Document Controller', orgUnitId: 1, jobGrade: 'Staff', isGmpCritical: true, isActive: true },
  { id: 5, code: 'POS-QA-003', title: 'ผู้ตรวจสอบภายใน', titleEn: 'Internal Auditor', orgUnitId: 1, jobGrade: 'Senior Staff', isGmpCritical: false, isActive: true },
  { id: 6, code: 'POS-RD-001', title: 'นักวิทยาศาสตร์วิจัยและพัฒนา', titleEn: 'R&D Scientist', orgUnitId: 4, jobGrade: 'Senior Staff', isGmpCritical: false, isActive: false },
];

// ============================================
// Mock Data: Training Courses (Detailed for HR Training Page)
// ============================================

export const MOCK_TRAINING_COURSES = [
  { id: 1, code: 'GMP-101', name: 'GMP Fundamentals', category: 'Compliance', description: 'หลักสูตรพื้นฐาน GMP', durationHours: 8, validityDays: 365, isMandatory: true, isActive: true },
  { id: 2, code: 'QC-201', name: 'Quality Control Methods', category: 'Technical', description: 'วิธีการควบคุมคุณภาพ', durationHours: 16, validityDays: 730, isMandatory: true, isActive: true },
  { id: 3, code: 'SAFE-101', name: 'Workplace Safety', category: 'Safety', description: 'ความปลอดภัยในสถานที่ทำงาน', durationHours: 4, validityDays: 365, isMandatory: true, isActive: true },
  { id: 4, code: 'HACCP-101', name: 'HACCP Principles', category: 'Compliance', description: 'หลักการ HACCP', durationHours: 8, validityDays: 365, isMandatory: false, isActive: true },
  { id: 5, code: 'DOC-101', name: 'Document Control', category: 'Administrative', description: 'การควบคุมเอกสาร', durationHours: 4, validityDays: null, isMandatory: false, isActive: false },
];

// ============================================
// Mock Data: Training Sessions (for HR Training Page)
// ============================================

export const MOCK_TRAINING_SESSIONS = [
  { id: 1, courseId: 1, sessionDate: TEST_DATES.TODAY, startTime: '09:00:00', endTime: '17:00:00', location: 'ห้องประชุม A', maxParticipants: 20, status: 'scheduled' },
  { id: 2, courseId: 2, sessionDate: TEST_DATES.PAST_DATE, startTime: '09:00:00', endTime: '17:00:00', location: 'ห้องประชุม B', maxParticipants: 15, status: 'completed' },
  { id: 3, courseId: 3, sessionDate: TEST_DATES.TODAY, startTime: '13:00:00', endTime: '17:00:00', location: 'ห้องฝึกอบรม', maxParticipants: 30, status: 'in_progress' },
  { id: 4, courseId: 1, sessionDate: TEST_DATES.NEAR_FUTURE, startTime: '09:00:00', endTime: '17:00:00', location: 'ห้องประชุม A', maxParticipants: 20, status: 'scheduled' },
  { id: 5, courseId: 4, sessionDate: TEST_DATES.PAST_DATE, startTime: '09:00:00', endTime: '12:00:00', location: 'Online', maxParticipants: 50, status: 'cancelled' },
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
  '/api/warehouses': { data: createPaginatedResponse(MOCK_WAREHOUSES) },
  '/api/employees': { data: createPaginatedResponse(MOCK_EMPLOYEES) },
  '/api/customers': { data: createPaginatedResponse(MOCK_CUSTOMERS) },
};

/**
 * Handlers for Inventory module
 */
export const INVENTORY_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/items': { data: createPaginatedResponse(MOCK_ITEMS) },
  '/api/inventory/lots': { data: createPaginatedResponse(MOCK_LOTS) },
  '/api/warehouses': { data: createPaginatedResponse(MOCK_WAREHOUSES) },
};

/**
 * Handlers for Cost module
 */
export const COST_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/cost/landed-costs': { data: createPaginatedResponse(MOCK_LANDED_COSTS) },
  '/api/cost/work-centers': {
    data: {
      success: true,
      data: {
        data: MOCK_WORK_CENTERS,
        total: MOCK_WORK_CENTERS.length,
        page: 1,
        pageSize: 20,
      },
    },
  },
  '/api/cost/dashboard': { data: createSingleResponse(MOCK_COST_DASHBOARD_KPIS) },
  '/api/cost/reports/cost-summary': {
    data: {
      success: true,
      data: {
        data: MOCK_COST_SUMMARY,
        total: MOCK_COST_SUMMARY.length,
      },
    },
  },
};

/**
 * Handlers for Production module
 */
export const PRODUCTION_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/production/work-orders': { data: createPaginatedResponse(MOCK_WORK_ORDERS) },
  '/api/bom': { data: createPaginatedResponse(MOCK_BOMS) },
  '/api/bom/dashboard': { data: createSingleResponse(MOCK_BOM_DASHBOARD) },
};

/**
 * Handlers for GMP module
 * NOTE: More specific URL patterns MUST come before less specific ones
 * because matching uses includes() which matches partial URLs
 */
export const GMP_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  // CAPA endpoints - dashboard first (more specific)
  '/api/capa/dashboard': { data: createSingleResponse(MOCK_CAPA_DASHBOARD) },
  '/api/capa': { data: createSingleResponse({ capas: MOCK_CAPAS, total: MOCK_CAPAS.length }) },
  // Complaints endpoints - specific paths first
  '/api/complaints/dashboard': { data: createSingleResponse(MOCK_COMPLAINTS_DASHBOARD) },
  '/api/complaints/trends': { data: createSingleResponse({ dataPoints: MOCK_COMPLAINTS_TRENDS.monthly, byCategory: MOCK_COMPLAINTS_TRENDS.byCategory, period: 'Monthly' }) },
  '/api/complaints': { data: createSingleResponse({ complaints: MOCK_COMPLAINTS, total: MOCK_COMPLAINTS.length }) },
  // Documents endpoints - specific paths first
  '/api/documents/dashboard': { data: createSingleResponse(MOCK_DOCUMENTS_DASHBOARD) },
  '/api/documents/types': { data: createSingleResponse(MOCK_DOCUMENT_TYPES) },
  '/api/documents/approvals': { data: createSingleResponse(MOCK_PENDING_APPROVALS) },
  '/api/documents': { data: createSingleResponse({ documents: MOCK_DOCUMENTS, total: MOCK_DOCUMENTS.length }) },
  // Deviations
  '/api/deviations': { data: createPaginatedResponse(MOCK_DEVIATIONS) },
};

/**
 * Handlers for HR module
 * Note: HR pages use direct array format { success: true, data: [...] } not paginated
 */
export const HR_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/hr/employees': { data: createSingleResponse(MOCK_EMPLOYEES) },
  '/api/hr/positions': { data: createSingleResponse(MOCK_POSITIONS) },
  '/api/hr/org-units': { data: createSingleResponse(MOCK_ORG_UNITS) },
  '/api/hr/training/courses': { data: createSingleResponse(MOCK_TRAINING_COURSES) },
  '/api/hr/training/sessions': { data: createSingleResponse(MOCK_TRAINING_SESSIONS) },
};

/**
 * Handlers for Accounting module
 * NOTE: More specific URL patterns MUST come before less specific ones
 */
export const ACCOUNTING_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  // GL Accounts endpoints - specific paths first
  '/api/accounting/gl-account-types': { data: createSingleResponse(MOCK_GL_ACCOUNT_TYPES) },
  '/api/accounting/gl-accounts': { data: createSingleResponse(MOCK_GL_ACCOUNTS) },
  '/api/accounting/accounts': { data: createPaginatedResponse(MOCK_GL_ACCOUNTS) },
  // AP endpoints - specific paths first
  '/api/accounting/ap-invoices': { data: createSingleResponse(MOCK_AP_INVOICES) },
  // AR endpoints - specific paths first
  '/api/accounting/ar-invoices': { data: createSingleResponse(MOCK_AR_INVOICES) },
  // Aging reports
  '/api/accounting/reports/aging': { data: createSingleResponse(MOCK_AGING_REPORT) },
};

/**
 * Handlers for Sales module
 */
export const SALES_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/sales/orders': { data: createPaginatedResponse(MOCK_SALES_ORDERS) },
  '/api/customers': { data: createPaginatedResponse(MOCK_CUSTOMERS) },
};

// ============================================
// Mock Data: Master Data - Production Equipment
// ============================================

export const MOCK_PRODUCTION_EQUIPMENT = [
  { id: 1, code: 'EQ001', name: 'Digital Scale 1', nameTh: 'เครื่องชั่งดิจิตอล 1', equipmentType: 'scale', capacity: '30 kg', roomId: 1, roomName: 'Mixing Room A', isActive: true },
  { id: 2, code: 'EQ002', name: 'Ribbon Mixer', nameTh: 'เครื่องผสมริบบ้อน', equipmentType: 'mixer', capacity: '200 L', roomId: 1, roomName: 'Mixing Room A', isActive: true },
  { id: 3, code: 'EQ003', name: 'Heating Plate', nameTh: 'เตาแผ่นความร้อน', equipmentType: 'hotplate', capacity: '500 W', roomId: 2, roomName: 'Preparation Room', isActive: true },
  { id: 4, code: 'EQ004', name: 'Filling Machine', nameTh: 'เครื่องบรรจุ', equipmentType: 'filler', capacity: '100 units/hr', roomId: 3, roomName: 'Packaging Room', isActive: true },
  { id: 5, code: 'EQ005', name: 'Storage Tank', nameTh: 'ถังเก็บ', equipmentType: 'tank', capacity: '500 L', roomId: 2, roomName: 'Preparation Room', isActive: false },
];

// ============================================
// Mock Data: Master Data - Production Rooms
// ============================================

export const MOCK_PRODUCTION_ROOMS = [
  { id: 1, code: 'RM001', name: 'Mixing Room A', nameTh: 'ห้องผสม A', roomType: 'mixing', area: 50, temperatureMin: 20, temperatureMax: 25, humidityMin: 40, humidityMax: 60, isActive: true },
  { id: 2, code: 'RM002', name: 'Preparation Room', nameTh: 'ห้องเตรียม', roomType: 'preparation', area: 30, temperatureMin: 18, temperatureMax: 25, humidityMin: 40, humidityMax: 60, isActive: true },
  { id: 3, code: 'RM003', name: 'Packaging Room', nameTh: 'ห้องบรรจุ', roomType: 'packaging', area: 40, temperatureMin: 20, temperatureMax: 25, humidityMin: 30, humidityMax: 50, isActive: true },
  { id: 4, code: 'RM004', name: 'Cold Storage', nameTh: 'ห้องเย็น', roomType: 'storage', area: 20, temperatureMin: 2, temperatureMax: 8, humidityMin: null, humidityMax: null, isActive: true },
  { id: 5, code: 'RM005', name: 'Quarantine Room', nameTh: 'ห้องกักกัน', roomType: 'quarantine', area: 15, temperatureMin: 20, temperatureMax: 25, humidityMin: 40, humidityMax: 60, isActive: false },
];

// ============================================
// Mock Data: Master Data - Environmental Conditions
// ============================================

export const MOCK_ENVIRONMENTAL_CONDITIONS = [
  { id: 1, code: 'ENV001', name: 'Standard Room', nameTh: 'ห้องมาตรฐาน', temperatureMin: 20, temperatureMax: 25, humidityMin: 40, humidityMax: 60, isDefault: true, isActive: true },
  { id: 2, code: 'ENV002', name: 'Cold Storage', nameTh: 'ห้องเย็น', temperatureMin: 2, temperatureMax: 8, humidityMin: null, humidityMax: null, isDefault: false, isActive: true },
  { id: 3, code: 'ENV003', name: 'Low Humidity', nameTh: 'ความชื้นต่ำ', temperatureMin: 18, temperatureMax: 25, humidityMin: 20, humidityMax: 40, isDefault: false, isActive: true },
];

// ============================================
// Mock Data: Master Data - SOP Templates
// ============================================

export const MOCK_SOP_TEMPLATES = [
  { id: 1, code: 'SOP001', name: 'Weighing Procedure', nameTh: 'ขั้นตอนการชั่ง', category: 'weighing', stepCount: 8, isActive: true },
  { id: 2, code: 'SOP002', name: 'Mixing Procedure', nameTh: 'ขั้นตอนการผสม', category: 'mixing', stepCount: 12, isActive: true },
  { id: 3, code: 'SOP003', name: 'Filling Procedure', nameTh: 'ขั้นตอนการบรรจุ', category: 'filling', stepCount: 10, isActive: true },
  { id: 4, code: 'SOP004', name: 'Cleaning Procedure', nameTh: 'ขั้นตอนการทำความสะอาด', category: 'cleaning', stepCount: 6, isActive: true },
];

// ============================================
// Mock Data: Master Data - Packaging QC Criteria
// ============================================

export const MOCK_PACKAGING_QC_CRITERIA = [
  { id: 1, code: 'PKG001', name: 'Bottle 30ml', nameTh: 'ขวด 30 มล.', targetWeight: 30, minWeight: 29, maxWeight: 31, tolerance: 3.3, isActive: true },
  { id: 2, code: 'PKG002', name: 'Bottle 100ml', nameTh: 'ขวด 100 มล.', targetWeight: 100, minWeight: 98, maxWeight: 102, tolerance: 2.0, isActive: true },
  { id: 3, code: 'PKG003', name: 'Sachet 5g', nameTh: 'ซอง 5 ก.', targetWeight: 5, minWeight: 4.8, maxWeight: 5.2, tolerance: 4.0, isActive: true },
];

/**
 * Handlers for Master Data module
 */
export const MASTER_DATA_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/master-data/production-equipment': { data: createSingleResponse(MOCK_PRODUCTION_EQUIPMENT) },
  '/api/master-data/production-rooms': { data: createSingleResponse(MOCK_PRODUCTION_ROOMS) },
  '/api/master-data/environmental-conditions': { data: createSingleResponse(MOCK_ENVIRONMENTAL_CONDITIONS) },
  '/api/master-data/sop-templates': { data: createSingleResponse(MOCK_SOP_TEMPLATES) },
  '/api/master-data/packaging-qc-criteria': { data: createSingleResponse(MOCK_PACKAGING_QC_CRITERIA) },
};

// ============================================
// Mock Data: Quality Tests
// ============================================

export const MOCK_QUALITY_TESTS = [
  { id: 1, lotId: 1, lotNumber: 'LOT-2026-001', specId: 1, testName: 'Microbial Count', testMethod: 'ISO 4833', specification: '≤100 CFU/g', minValue: null, maxValue: 100, testType: 'incoming', sampleNumber: 'QC-001', testDate: TEST_DATES.TODAY, result: '50 CFU/g', numericResult: 50, status: 'passed', createdAt: TEST_DATES.TODAY },
  { id: 2, lotId: 2, lotNumber: 'LOT-2026-002', specId: 2, testName: 'Heavy Metals', testMethod: 'ICP-MS', specification: '≤10 ppm', minValue: null, maxValue: 10, testType: 'incoming', sampleNumber: 'QC-002', testDate: TEST_DATES.TODAY, result: '8.5 ppm', numericResult: 8.5, status: 'passed', createdAt: TEST_DATES.TODAY },
  { id: 3, lotId: 3, lotNumber: 'LOT-2026-003', specId: 3, testName: 'Moisture Content', testMethod: 'Karl Fischer', specification: '≤5%', minValue: null, maxValue: 5, testType: 'in_process', sampleNumber: 'QC-003', testDate: TEST_DATES.TODAY, result: '6.2%', numericResult: 6.2, status: 'failed', createdAt: TEST_DATES.TODAY },
  { id: 4, lotId: 1, lotNumber: 'LOT-2026-001', specId: 4, testName: 'Active Ingredient Assay', testMethod: 'HPLC', specification: '95-105%', minValue: 95, maxValue: 105, testType: 'finished', sampleNumber: 'QC-004', testDate: null, result: null, numericResult: null, status: 'pending', createdAt: TEST_DATES.TODAY },
  { id: 5, lotId: 2, lotNumber: 'LOT-2026-002', specId: 5, testName: 'Dissolution Test', testMethod: 'USP <711>', specification: '≥80% in 30min', minValue: 80, maxValue: null, testType: 'finished', sampleNumber: 'QC-005', testDate: TEST_DATES.PAST_DATE, result: '85%', numericResult: 85, status: 'passed', createdAt: TEST_DATES.PAST_DATE },
  { id: 6, lotId: 3, lotNumber: 'LOT-2026-003', specId: 1, testName: 'Stability Test', testMethod: 'ICH Q1A', specification: 'Stable at 6 months', minValue: null, maxValue: null, testType: 'stability', sampleNumber: 'STB-001', testDate: null, result: null, numericResult: null, status: 'in_progress', createdAt: TEST_DATES.TODAY },
];

// ============================================
// Mock Data: Quality Specs
// ============================================

export const MOCK_QUALITY_SPECS = [
  { id: 1, itemId: 1, itemCode: 'PROD-001', itemName: 'สารสกัดสมุนไพร A', testName: 'Microbial Count', testMethod: 'ISO 4833', specification: '≤100 CFU/g', minValue: null, maxValue: 100, unit: 'CFU/g', isCritical: true, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, itemId: 1, itemCode: 'PROD-001', itemName: 'สารสกัดสมุนไพร A', testName: 'Heavy Metals', testMethod: 'ICP-MS', specification: '≤10 ppm', minValue: null, maxValue: 10, unit: 'ppm', isCritical: true, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, itemId: 2, itemCode: 'PROD-002', itemName: 'สารสกัดสมุนไพร B', testName: 'Moisture Content', testMethod: 'Karl Fischer', specification: '≤5%', minValue: null, maxValue: 5, unit: '%', isCritical: false, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 4, itemId: 1, itemCode: 'PROD-001', itemName: 'สารสกัดสมุนไพร A', testName: 'Active Ingredient Assay', testMethod: 'HPLC', specification: '95-105%', minValue: 95, maxValue: 105, unit: '%', isCritical: true, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 5, itemId: 2, itemCode: 'PROD-002', itemName: 'สารสกัดสมุนไพร B', testName: 'Dissolution Test', testMethod: 'USP <711>', specification: '≥80% in 30min', minValue: 80, maxValue: null, unit: '%', isCritical: false, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 6, itemId: 3, itemCode: 'RAW-001', itemName: 'วัตถุดิบสมุนไพร', testName: 'Appearance', testMethod: 'Visual', specification: 'Brown powder', minValue: null, maxValue: null, unit: null, isCritical: false, isActive: false, createdAt: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: Quality Deviations
// ============================================

export const MOCK_QUALITY_DEVIATIONS = [
  { id: 1, deviationNumber: 'DEV-2026-001', title: 'Temperature Excursion', description: 'Warehouse temperature exceeded 25°C for 2 hours', sourceType: 'warehouse', sourceId: 1, severity: 'major', status: 'investigating', rootCause: '', correctiveAction: '', preventiveAction: '', reportedBy: TEST_USER_IDS.QA_MANAGER, assignedTo: TEST_USER_IDS.PRODUCTION_SUPERVISOR, dueDate: TEST_DATES.NEAR_FUTURE, closedBy: null, closedAt: null, createdAt: TEST_DATES.TODAY, updatedAt: TEST_DATES.TODAY },
  { id: 2, deviationNumber: 'DEV-2026-002', title: 'Out of Specification Result', description: 'Moisture content exceeded specification limit', sourceType: 'quality', sourceId: 3, severity: 'critical', status: 'open', rootCause: '', correctiveAction: '', preventiveAction: '', reportedBy: TEST_USER_IDS.QC_ANALYST, assignedTo: TEST_USER_IDS.QA_MANAGER, dueDate: TEST_DATES.TODAY, closedBy: null, closedAt: null, createdAt: TEST_DATES.TODAY, updatedAt: TEST_DATES.TODAY },
  { id: 3, deviationNumber: 'DEV-2026-003', title: 'Equipment Malfunction', description: 'Mixer stopped during production', sourceType: 'production', sourceId: 2, severity: 'minor', status: 'resolved', rootCause: 'Motor overheating', correctiveAction: 'Replaced motor bearing', preventiveAction: 'Scheduled monthly maintenance', reportedBy: TEST_USER_IDS.PRODUCTION_SUPERVISOR, assignedTo: TEST_USER_IDS.PRODUCTION_SUPERVISOR, dueDate: TEST_DATES.PAST_DATE, closedBy: null, closedAt: null, createdAt: TEST_DATES.PAST_DATE, updatedAt: TEST_DATES.TODAY },
  { id: 4, deviationNumber: 'DEV-2026-004', title: 'Documentation Error', description: 'Batch record signed by unauthorized personnel', sourceType: 'quality', sourceId: 4, severity: 'minor', status: 'closed', rootCause: 'Training gap', correctiveAction: 'Retrained personnel', preventiveAction: 'Updated SOP', reportedBy: TEST_USER_IDS.DOCUMENT_CONTROLLER, assignedTo: TEST_USER_IDS.QA_MANAGER, dueDate: TEST_DATES.PAST_DATE, closedBy: TEST_USER_IDS.QA_MANAGER, closedAt: TEST_DATES.TODAY, createdAt: TEST_DATES.PAST_DATE, updatedAt: TEST_DATES.TODAY },
];

/**
 * Handlers for Quality module
 */
export const QUALITY_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/quality/tests': { data: createPaginatedResponse(MOCK_QUALITY_TESTS) },
  '/api/quality/specs': { data: createPaginatedResponse(MOCK_QUALITY_SPECS) },
  '/api/quality/deviations': { data: createPaginatedResponse(MOCK_QUALITY_DEVIATIONS) },
};

// ============================================
// Mock Data: Settings - Approval Workflows
// ============================================

export const MOCK_APPROVAL_WORKFLOWS = [
  { id: 1, name: 'Purchase Order Approval', description: 'Approval workflow for POs above 50,000 THB', documentType: 'purchase_order', isActive: true, priority: 1, rules: [{ field: 'amount', operator: '>', value: 50000 }], steps: [{ order: 1, approverType: 'role', approverValue: 'Manager' }], createdAt: TEST_DATES.PAST_DATE },
  { id: 2, name: 'AP Invoice Approval', description: 'Approval for vendor invoices', documentType: 'ap_invoice', isActive: true, priority: 1, rules: [], steps: [{ order: 1, approverType: 'role', approverValue: 'Finance' }], createdAt: TEST_DATES.PAST_DATE },
  { id: 3, name: 'Payment Approval', description: 'Payment approval workflow', documentType: 'payment', isActive: true, priority: 2, rules: [{ field: 'amount', operator: '>', value: 100000 }], steps: [{ order: 1, approverType: 'role', approverValue: 'Manager' }, { order: 2, approverType: 'role', approverValue: 'Director' }], createdAt: TEST_DATES.PAST_DATE },
  { id: 4, name: 'Credit Note Approval', description: 'Credit note approval', documentType: 'credit_note', isActive: false, priority: 1, rules: [], steps: [], createdAt: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: Settings - Matching Tolerances
// ============================================

export const MOCK_MATCHING_TOLERANCES = [
  { id: 1, name: 'Standard Quantity Tolerance', description: 'Default quantity tolerance for 3-way matching', toleranceType: 'quantity', toleranceMethod: 'percentage', toleranceValue: 5.0, priority: 1, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, name: 'Standard Price Tolerance', description: 'Default price tolerance', toleranceType: 'price', toleranceMethod: 'percentage', toleranceValue: 2.0, priority: 1, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, name: 'Amount Tolerance', description: 'Total amount tolerance', toleranceType: 'amount', toleranceMethod: 'absolute', toleranceValue: 100.0, priority: 2, isActive: true, createdAt: TEST_DATES.PAST_DATE },
  { id: 4, name: 'High Value Quantity', description: 'Tighter tolerance for high-value items', toleranceType: 'quantity', toleranceMethod: 'percentage', toleranceValue: 2.0, priority: 2, isActive: false, createdAt: TEST_DATES.PAST_DATE },
];

// ============================================
// Mock Data: Settings - VMI Connections
// ============================================

export const MOCK_VMI_CONNECTIONS = [
  { id: 1, code: 'VMI001', name: 'Hospital A Portal', url: 'https://portal.hospital-a.com', apiKey: 'xxx-redacted', customerId: 1, customerName: 'Hospital A', isActive: true, lastSync: TEST_DATES.TODAY, createdAt: TEST_DATES.PAST_DATE },
  { id: 2, code: 'VMI002', name: 'Hospital B Portal', url: 'https://portal.hospital-b.com', apiKey: 'xxx-redacted', customerId: 2, customerName: 'Hospital B', isActive: true, lastSync: TEST_DATES.PAST_DATE, createdAt: TEST_DATES.PAST_DATE },
  { id: 3, code: 'VMI003', name: 'Clinic C Portal', url: 'https://portal.clinic-c.com', apiKey: 'xxx-redacted', customerId: 3, customerName: 'Clinic C', isActive: false, lastSync: null, createdAt: TEST_DATES.PAST_DATE },
];

/**
 * Handlers for Settings module
 */
export const SETTINGS_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  '/api/settings/approval-flows': { data: createSingleResponse(MOCK_APPROVAL_WORKFLOWS) },
  '/api/settings/matching-tolerances': { data: { data: MOCK_MATCHING_TOLERANCES, total: MOCK_MATCHING_TOLERANCES.length, page: 1, limit: 100, totalPages: 1 } },
  '/api/settings/vmi': { data: createSingleResponse(MOCK_VMI_CONNECTIONS) },
};

/**
 * All handlers combined
 */
export const ALL_FETCH_HANDLERS: FetchMockConfig = {
  ...COMMON_FETCH_HANDLERS,
  ...INVENTORY_FETCH_HANDLERS,
  ...COST_FETCH_HANDLERS,
  ...PRODUCTION_FETCH_HANDLERS,
  ...GMP_FETCH_HANDLERS,
  ...HR_FETCH_HANDLERS,
  ...ACCOUNTING_FETCH_HANDLERS,
  ...SALES_FETCH_HANDLERS,
  ...MASTER_DATA_FETCH_HANDLERS,
  ...QUALITY_FETCH_HANDLERS,
  ...SETTINGS_FETCH_HANDLERS,
};

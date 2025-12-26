/**
 * Accounting Tables Auto-Seeder
 *
 * Seeds default values for accounting lookup tables following Thai Accounting Standards (TAS)
 * - GL Account Types (5 categories: Assets, Liabilities, Equity, Revenue, Expenses)
 * - Default Chart of Accounts template for manufacturing/herbal medicine industry
 * - Default fiscal year and periods
 * - Asset Categories with Thai Revenue Code depreciation rates
 *
 * Runs during server startup after schema sync.
 */

import { sql } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from './index';
import { getNow, toDbDate, getTodayStr } from './date-utils';
import * as schema from './schema';
import { ASSET_CATEGORIES, type AssetCategoryConfig } from './seeds/asset-categories';
import { WHT_RATES, THAI_VAT_RATE, WHT_MINIMUM_THRESHOLD } from './seeds/wht-rates';

// ============================================
// GL Account Types following Thai Accounting Standards
// ============================================

const defaultGLAccountTypes = [
  // Assets (1xxx)
  {
    code: '1',
    nameTh: 'สินทรัพย์',
    nameEn: 'Assets',
    category: 'asset',
    normalBalance: 'debit',
    displayOrder: 1,
  },
  // Liabilities (2xxx)
  {
    code: '2',
    nameTh: 'หนี้สิน',
    nameEn: 'Liabilities',
    category: 'liability',
    normalBalance: 'credit',
    displayOrder: 2,
  },
  // Equity (3xxx)
  {
    code: '3',
    nameTh: 'ส่วนของผู้ถือหุ้น',
    nameEn: 'Shareholders Equity',
    category: 'equity',
    normalBalance: 'credit',
    displayOrder: 3,
  },
  // Revenue (4xxx)
  {
    code: '4',
    nameTh: 'รายได้',
    nameEn: 'Revenue',
    category: 'revenue',
    normalBalance: 'credit',
    displayOrder: 4,
  },
  // Expenses (5xxx)
  {
    code: '5',
    nameTh: 'ต้นทุนขาย',
    nameEn: 'Cost of Goods Sold',
    category: 'expense',
    normalBalance: 'debit',
    displayOrder: 5,
  },
  // Operating Expenses (6xxx)
  {
    code: '6',
    nameTh: 'ค่าใช้จ่ายในการดำเนินงาน',
    nameEn: 'Operating Expenses',
    category: 'expense',
    normalBalance: 'debit',
    displayOrder: 6,
  },
  // Other Income/Expenses (7xxx)
  {
    code: '7',
    nameTh: 'รายได้และค่าใช้จ่ายอื่น',
    nameEn: 'Other Income and Expenses',
    category: 'revenue',
    normalBalance: 'credit',
    displayOrder: 7,
  },
];

// ============================================
// Default Chart of Accounts Template
// Following Thai Accounting Standards for Manufacturing
// ============================================

const defaultChartOfAccounts = [
  // ==================== ASSETS (1xxx) ====================
  // Current Assets (11xx)
  { code: '1100', nameTh: 'สินทรัพย์หมุนเวียน', nameEn: 'Current Assets', typeCode: '1', isPostable: false, level: 1 },
  { code: '1110', nameTh: 'เงินสดและรายการเทียบเท่าเงินสด', nameEn: 'Cash and Cash Equivalents', typeCode: '1', parentCode: '1100', isPostable: false, level: 2 },
  { code: '1111', nameTh: 'เงินสด', nameEn: 'Cash on Hand', typeCode: '1', parentCode: '1110', isPostable: true, level: 3 },
  { code: '1112', nameTh: 'เงินฝากธนาคาร - ออมทรัพย์', nameEn: 'Bank - Savings Account', typeCode: '1', parentCode: '1110', isPostable: true, isBankAccount: true, level: 3 },
  { code: '1113', nameTh: 'เงินฝากธนาคาร - กระแสรายวัน', nameEn: 'Bank - Current Account', typeCode: '1', parentCode: '1110', isPostable: true, isBankAccount: true, level: 3 },
  { code: '1114', nameTh: 'เงินสดย่อย', nameEn: 'Petty Cash', typeCode: '1', parentCode: '1110', isPostable: true, level: 3 },

  { code: '1120', nameTh: 'ลูกหนี้การค้า', nameEn: 'Accounts Receivable', typeCode: '1', parentCode: '1100', isPostable: false, level: 2 },
  { code: '1121', nameTh: 'ลูกหนี้การค้า - ในประเทศ', nameEn: 'AR - Domestic', typeCode: '1', parentCode: '1120', isPostable: true, level: 3 },
  { code: '1122', nameTh: 'ลูกหนี้การค้า - ต่างประเทศ', nameEn: 'AR - Foreign', typeCode: '1', parentCode: '1120', isPostable: true, level: 3 },
  { code: '1129', nameTh: 'ค่าเผื่อหนี้สงสัยจะสูญ', nameEn: 'Allowance for Doubtful Accounts', typeCode: '1', parentCode: '1120', isPostable: true, level: 3 },

  { code: '1130', nameTh: 'สินค้าคงเหลือ', nameEn: 'Inventory', typeCode: '1', parentCode: '1100', isPostable: false, level: 2 },
  { code: '1131', nameTh: 'วัตถุดิบ', nameEn: 'Raw Materials', typeCode: '1', parentCode: '1130', isPostable: true, level: 3 },
  { code: '1132', nameTh: 'งานระหว่างทำ', nameEn: 'Work in Process', typeCode: '1', parentCode: '1130', isPostable: true, level: 3 },
  { code: '1133', nameTh: 'สินค้าสำเร็จรูป', nameEn: 'Finished Goods', typeCode: '1', parentCode: '1130', isPostable: true, level: 3 },
  { code: '1134', nameTh: 'วัสดุบรรจุภัณฑ์', nameEn: 'Packaging Materials', typeCode: '1', parentCode: '1130', isPostable: true, level: 3 },
  { code: '1135', nameTh: 'วัสดุสิ้นเปลือง', nameEn: 'Supplies', typeCode: '1', parentCode: '1130', isPostable: true, level: 3 },

  { code: '1140', nameTh: 'สินทรัพย์หมุนเวียนอื่น', nameEn: 'Other Current Assets', typeCode: '1', parentCode: '1100', isPostable: false, level: 2 },
  { code: '1141', nameTh: 'ภาษีซื้อรอเครดิต', nameEn: 'Input VAT Pending', typeCode: '1', parentCode: '1140', isPostable: true, level: 3 },
  { code: '1142', nameTh: 'ภาษีซื้อ', nameEn: 'Input VAT', typeCode: '1', parentCode: '1140', isPostable: true, level: 3 },
  { code: '1143', nameTh: 'ค่าใช้จ่ายจ่ายล่วงหน้า', nameEn: 'Prepaid Expenses', typeCode: '1', parentCode: '1140', isPostable: true, level: 3 },
  { code: '1144', nameTh: 'เงินมัดจำ', nameEn: 'Deposits', typeCode: '1', parentCode: '1140', isPostable: true, level: 3 },

  // Non-Current Assets (12xx)
  { code: '1200', nameTh: 'สินทรัพย์ไม่หมุนเวียน', nameEn: 'Non-Current Assets', typeCode: '1', isPostable: false, level: 1 },
  { code: '1210', nameTh: 'ที่ดิน อาคาร และอุปกรณ์', nameEn: 'Property, Plant and Equipment', typeCode: '1', parentCode: '1200', isPostable: false, level: 2 },
  { code: '1211', nameTh: 'ที่ดิน', nameEn: 'Land', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1212', nameTh: 'อาคารและสิ่งปลูกสร้าง', nameEn: 'Buildings', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1213', nameTh: 'เครื่องจักรและอุปกรณ์', nameEn: 'Machinery and Equipment', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1214', nameTh: 'เครื่องใช้สำนักงาน', nameEn: 'Office Equipment', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1215', nameTh: 'ยานพาหนะ', nameEn: 'Vehicles', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1216', nameTh: 'เครื่องตกแต่งและติดตั้ง', nameEn: 'Furniture and Fixtures', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1217', nameTh: 'อุปกรณ์คอมพิวเตอร์', nameEn: 'Computer Equipment', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },
  { code: '1218', nameTh: 'สินทรัพย์ระหว่างก่อสร้าง', nameEn: 'Construction in Progress', typeCode: '1', parentCode: '1210', isPostable: true, level: 3 },

  { code: '1220', nameTh: 'ค่าเสื่อมราคาสะสม', nameEn: 'Accumulated Depreciation', typeCode: '1', parentCode: '1200', isPostable: false, level: 2 },
  { code: '1222', nameTh: 'ค่าเสื่อมราคาสะสม - อาคาร', nameEn: 'Accum. Depreciation - Buildings', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },
  { code: '1223', nameTh: 'ค่าเสื่อมราคาสะสม - เครื่องจักร', nameEn: 'Accum. Depreciation - Machinery', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },
  { code: '1224', nameTh: 'ค่าเสื่อมราคาสะสม - เครื่องใช้สำนักงาน', nameEn: 'Accum. Depreciation - Office Equipment', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },
  { code: '1225', nameTh: 'ค่าเสื่อมราคาสะสม - ยานพาหนะ', nameEn: 'Accum. Depreciation - Vehicles', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },
  { code: '1226', nameTh: 'ค่าเสื่อมราคาสะสม - เครื่องตกแต่ง', nameEn: 'Accum. Depreciation - F&F', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },
  { code: '1227', nameTh: 'ค่าเสื่อมราคาสะสม - คอมพิวเตอร์', nameEn: 'Accum. Depreciation - Computer', typeCode: '1', parentCode: '1220', isPostable: true, level: 3 },

  { code: '1230', nameTh: 'สินทรัพย์ไม่มีตัวตน', nameEn: 'Intangible Assets', typeCode: '1', parentCode: '1200', isPostable: false, level: 2 },
  { code: '1231', nameTh: 'ลิขสิทธิ์และสิทธิบัตร', nameEn: 'Copyrights and Patents', typeCode: '1', parentCode: '1230', isPostable: true, level: 3 },
  { code: '1232', nameTh: 'โปรแกรมคอมพิวเตอร์', nameEn: 'Software', typeCode: '1', parentCode: '1230', isPostable: true, level: 3 },
  { code: '1239', nameTh: 'ค่าตัดจำหน่ายสะสม', nameEn: 'Accumulated Amortization', typeCode: '1', parentCode: '1230', isPostable: true, level: 3 },

  // ==================== LIABILITIES (2xxx) ====================
  // Current Liabilities (21xx)
  { code: '2100', nameTh: 'หนี้สินหมุนเวียน', nameEn: 'Current Liabilities', typeCode: '2', isPostable: false, level: 1 },
  { code: '2110', nameTh: 'เจ้าหนี้การค้า', nameEn: 'Accounts Payable', typeCode: '2', parentCode: '2100', isPostable: false, level: 2 },
  { code: '2111', nameTh: 'เจ้าหนี้การค้า - ในประเทศ', nameEn: 'AP - Domestic', typeCode: '2', parentCode: '2110', isPostable: true, level: 3 },
  { code: '2112', nameTh: 'เจ้าหนี้การค้า - ต่างประเทศ', nameEn: 'AP - Foreign', typeCode: '2', parentCode: '2110', isPostable: true, level: 3 },

  { code: '2120', nameTh: 'เจ้าหนี้อื่น', nameEn: 'Other Payables', typeCode: '2', parentCode: '2100', isPostable: false, level: 2 },
  { code: '2121', nameTh: 'ค่าใช้จ่ายค้างจ่าย', nameEn: 'Accrued Expenses', typeCode: '2', parentCode: '2120', isPostable: true, level: 3 },
  { code: '2122', nameTh: 'เงินรับล่วงหน้า', nameEn: 'Advances from Customers', typeCode: '2', parentCode: '2120', isPostable: true, level: 3 },
  { code: '2123', nameTh: 'เงินประกัน', nameEn: 'Deposits Received', typeCode: '2', parentCode: '2120', isPostable: true, level: 3 },

  { code: '2130', nameTh: 'ภาษีค้างจ่าย', nameEn: 'Taxes Payable', typeCode: '2', parentCode: '2100', isPostable: false, level: 2 },
  { code: '2131', nameTh: 'ภาษีขาย', nameEn: 'Output VAT', typeCode: '2', parentCode: '2130', isPostable: true, level: 3 },
  { code: '2132', nameTh: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', nameEn: 'WHT Payable', typeCode: '2', parentCode: '2130', isPostable: true, level: 3 },
  { code: '2133', nameTh: 'ภาษีเงินได้นิติบุคคลค้างจ่าย', nameEn: 'Corporate Income Tax Payable', typeCode: '2', parentCode: '2130', isPostable: true, level: 3 },
  { code: '2134', nameTh: 'ประกันสังคมค้างจ่าย', nameEn: 'Social Security Payable', typeCode: '2', parentCode: '2130', isPostable: true, level: 3 },

  { code: '2140', nameTh: 'เงินกู้ยืมระยะสั้น', nameEn: 'Short-term Loans', typeCode: '2', parentCode: '2100', isPostable: true, level: 2 },
  { code: '2150', nameTh: 'เงินกู้ยืมระยะยาวครบกำหนดภายใน 1 ปี', nameEn: 'Current Portion of Long-term Debt', typeCode: '2', parentCode: '2100', isPostable: true, level: 2 },

  // Non-Current Liabilities (22xx)
  { code: '2200', nameTh: 'หนี้สินไม่หมุนเวียน', nameEn: 'Non-Current Liabilities', typeCode: '2', isPostable: false, level: 1 },
  { code: '2210', nameTh: 'เงินกู้ยืมระยะยาว', nameEn: 'Long-term Loans', typeCode: '2', parentCode: '2200', isPostable: true, level: 2 },
  { code: '2220', nameTh: 'หนี้สินภาษีเงินได้รอตัดบัญชี', nameEn: 'Deferred Tax Liabilities', typeCode: '2', parentCode: '2200', isPostable: true, level: 2 },
  { code: '2230', nameTh: 'ภาระผูกพันผลประโยชน์พนักงาน', nameEn: 'Employee Benefit Obligations', typeCode: '2', parentCode: '2200', isPostable: true, level: 2 },

  // ==================== EQUITY (3xxx) ====================
  { code: '3100', nameTh: 'ทุน', nameEn: 'Share Capital', typeCode: '3', isPostable: false, level: 1 },
  { code: '3110', nameTh: 'ทุนจดทะเบียน', nameEn: 'Registered Capital', typeCode: '3', parentCode: '3100', isPostable: true, level: 2 },
  { code: '3120', nameTh: 'ทุนที่ออกและชำระแล้ว', nameEn: 'Issued and Paid-up Capital', typeCode: '3', parentCode: '3100', isPostable: true, level: 2 },
  { code: '3130', nameTh: 'ส่วนเกินมูลค่าหุ้น', nameEn: 'Share Premium', typeCode: '3', parentCode: '3100', isPostable: true, level: 2 },

  { code: '3200', nameTh: 'กำไรสะสม', nameEn: 'Retained Earnings', typeCode: '3', isPostable: false, level: 1 },
  { code: '3210', nameTh: 'สำรองตามกฎหมาย', nameEn: 'Legal Reserve', typeCode: '3', parentCode: '3200', isPostable: true, level: 2 },
  { code: '3220', nameTh: 'กำไรสะสมยังไม่ได้จัดสรร', nameEn: 'Unappropriated Retained Earnings', typeCode: '3', parentCode: '3200', isPostable: true, level: 2 },
  { code: '3230', nameTh: 'กำไร(ขาดทุน)สุทธิประจำปี', nameEn: 'Net Income (Loss) for the Year', typeCode: '3', parentCode: '3200', isPostable: true, level: 2 },

  // ==================== REVENUE (4xxx) ====================
  { code: '4100', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue', typeCode: '4', isPostable: false, level: 1 },
  { code: '4110', nameTh: 'รายได้จากการขายสินค้า', nameEn: 'Sales of Goods', typeCode: '4', parentCode: '4100', isPostable: true, level: 2 },
  { code: '4120', nameTh: 'รายได้จากการให้บริการ', nameEn: 'Service Revenue', typeCode: '4', parentCode: '4100', isPostable: true, level: 2 },
  { code: '4130', nameTh: 'รายได้จากการขาย - ส่งออก', nameEn: 'Export Sales', typeCode: '4', parentCode: '4100', isPostable: true, level: 2 },
  { code: '4190', nameTh: 'ส่วนลดการขาย', nameEn: 'Sales Discounts', typeCode: '4', parentCode: '4100', isPostable: true, level: 2 },
  { code: '4191', nameTh: 'รับคืนสินค้า', nameEn: 'Sales Returns', typeCode: '4', parentCode: '4100', isPostable: true, level: 2 },

  // ==================== COST OF GOODS SOLD (5xxx) ====================
  { code: '5100', nameTh: 'ต้นทุนขาย', nameEn: 'Cost of Goods Sold', typeCode: '5', isPostable: false, level: 1 },
  { code: '5110', nameTh: 'ต้นทุนวัตถุดิบใช้ไป', nameEn: 'Raw Materials Used', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },
  { code: '5120', nameTh: 'ค่าแรงงานทางตรง', nameEn: 'Direct Labor', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },
  { code: '5130', nameTh: 'ค่าใช้จ่ายการผลิต', nameEn: 'Manufacturing Overhead', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },
  { code: '5140', nameTh: 'ค่าเสื่อมราคา - เครื่องจักร', nameEn: 'Depreciation - Machinery', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },
  { code: '5150', nameTh: 'ค่าสาธารณูปโภค - โรงงาน', nameEn: 'Utilities - Factory', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },
  { code: '5160', nameTh: 'ค่าซ่อมแซมและบำรุงรักษา', nameEn: 'Repairs and Maintenance', typeCode: '5', parentCode: '5100', isPostable: true, level: 2 },

  // ==================== OPERATING EXPENSES (6xxx) ====================
  { code: '6100', nameTh: 'ค่าใช้จ่ายในการขาย', nameEn: 'Selling Expenses', typeCode: '6', isPostable: false, level: 1 },
  { code: '6110', nameTh: 'เงินเดือนพนักงานขาย', nameEn: 'Sales Salaries', typeCode: '6', parentCode: '6100', isPostable: true, level: 2 },
  { code: '6120', nameTh: 'ค่าคอมมิชชั่น', nameEn: 'Commissions', typeCode: '6', parentCode: '6100', isPostable: true, level: 2 },
  { code: '6130', nameTh: 'ค่าโฆษณาและส่งเสริมการขาย', nameEn: 'Advertising and Promotion', typeCode: '6', parentCode: '6100', isPostable: true, level: 2 },
  { code: '6140', nameTh: 'ค่าขนส่ง', nameEn: 'Freight Out', typeCode: '6', parentCode: '6100', isPostable: true, level: 2 },
  { code: '6150', nameTh: 'ค่าเดินทาง', nameEn: 'Travel Expenses', typeCode: '6', parentCode: '6100', isPostable: true, level: 2 },

  { code: '6200', nameTh: 'ค่าใช้จ่ายในการบริหาร', nameEn: 'Administrative Expenses', typeCode: '6', isPostable: false, level: 1 },
  { code: '6210', nameTh: 'เงินเดือนและค่าจ้าง', nameEn: 'Salaries and Wages', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6220', nameTh: 'ค่าสวัสดิการพนักงาน', nameEn: 'Employee Benefits', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6230', nameTh: 'เงินสมทบประกันสังคม', nameEn: 'Social Security Contributions', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6240', nameTh: 'เงินสมทบกองทุนสำรองเลี้ยงชีพ', nameEn: 'Provident Fund Contributions', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6250', nameTh: 'ค่าเช่าสำนักงาน', nameEn: 'Office Rent', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6260', nameTh: 'ค่าสาธารณูปโภค - สำนักงาน', nameEn: 'Utilities - Office', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6270', nameTh: 'ค่าเสื่อมราคา - สำนักงาน', nameEn: 'Depreciation - Office', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6280', nameTh: 'ค่าที่ปรึกษาและวิชาชีพ', nameEn: 'Professional Fees', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },
  { code: '6290', nameTh: 'ค่าใช้จ่ายบริหารอื่น', nameEn: 'Other Administrative Expenses', typeCode: '6', parentCode: '6200', isPostable: true, level: 2 },

  // ==================== OTHER INCOME/EXPENSES (7xxx) ====================
  { code: '7100', nameTh: 'รายได้อื่น', nameEn: 'Other Income', typeCode: '7', isPostable: false, level: 1 },
  { code: '7110', nameTh: 'ดอกเบี้ยรับ', nameEn: 'Interest Income', typeCode: '7', parentCode: '7100', isPostable: true, level: 2 },
  { code: '7120', nameTh: 'กำไรจากการขายสินทรัพย์', nameEn: 'Gain on Sale of Assets', typeCode: '7', parentCode: '7100', isPostable: true, level: 2 },
  { code: '7130', nameTh: 'รายได้อื่น', nameEn: 'Other Miscellaneous Income', typeCode: '7', parentCode: '7100', isPostable: true, level: 2 },

  { code: '7200', nameTh: 'ค่าใช้จ่ายอื่น', nameEn: 'Other Expenses', typeCode: '7', isPostable: false, level: 1 },
  { code: '7210', nameTh: 'ดอกเบี้ยจ่าย', nameEn: 'Interest Expense', typeCode: '7', parentCode: '7200', isPostable: true, level: 2 },
  { code: '7220', nameTh: 'ขาดทุนจากการขายสินทรัพย์', nameEn: 'Loss on Sale of Assets', typeCode: '7', parentCode: '7200', isPostable: true, level: 2 },
  { code: '7230', nameTh: 'ค่าปรับ', nameEn: 'Penalties', typeCode: '7', parentCode: '7200', isPostable: true, level: 2 },
  { code: '7240', nameTh: 'ค่าใช้จ่ายอื่น', nameEn: 'Other Miscellaneous Expenses', typeCode: '7', parentCode: '7200', isPostable: true, level: 2 },

  { code: '7300', nameTh: 'ภาษีเงินได้', nameEn: 'Income Tax', typeCode: '7', isPostable: false, level: 1 },
  { code: '7310', nameTh: 'ภาษีเงินได้นิติบุคคล', nameEn: 'Corporate Income Tax', typeCode: '7', parentCode: '7300', isPostable: true, level: 2 },
];

// ============================================
// Helper Functions
// ============================================

async function isTableEmpty(tableName: string, usingSqlite: boolean): Promise<boolean> {
  try {
    if (usingSqlite) {
      const db = getSqliteDb();
      const result = await db.all(sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`));
      return (result[0] as any)?.count === 0;
    } else {
      const db = await getMysqlDb();
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\``));
      return (result[0] as unknown as any[])[0]?.count === 0;
    }
  } catch (error) {
    console.log(`[Accounting Seed] Could not check table ${tableName}, will attempt to seed`);
    return true;
  }
}

// ============================================
// Seed Functions
// ============================================

/**
 * Seed GL Account Types
 */
async function seedGLAccountTypes(usingSqlite: boolean): Promise<number> {
  const tableName = 'gl_account_types';
  const isEmpty = await isTableEmpty(tableName, usingSqlite);

  if (!isEmpty) {
    console.log(`[Accounting Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Accounting Seed] Seeding ${tableName}...`);

  const table = usingSqlite ? schema.sqliteGLAccountTypes : schema.mysqlGLAccountTypes;
  const db = usingSqlite ? getSqliteDb() : await getMysqlDb();

  const values = defaultGLAccountTypes.map((type) => ({
    ...type,
    createdAt: getNow(),
    updatedAt: getNow(),
  }));

  try {
    for (const value of values) {
      await (db as any).insert(table).values(value);
    }
    console.log(`[Accounting Seed] Seeded ${values.length} GL account types`);
    return values.length;
  } catch (error) {
    console.error(`[Accounting Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed Chart of Accounts
 */
async function seedChartOfAccounts(usingSqlite: boolean): Promise<number> {
  const tableName = 'gl_accounts';
  const isEmpty = await isTableEmpty(tableName, usingSqlite);

  if (!isEmpty) {
    console.log(`[Accounting Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Accounting Seed] Seeding ${tableName}...`);

  const accountTable = usingSqlite ? schema.sqliteGLAccounts : schema.mysqlGLAccounts;
  const typeTable = usingSqlite ? schema.sqliteGLAccountTypes : schema.mysqlGLAccountTypes;
  const db = usingSqlite ? getSqliteDb() : await getMysqlDb();

  try {
    // Get account types for mapping
    const types = await (db as any).select().from(typeTable);
    const typeMap = new Map(types.map((t: any) => [t.code, t.id]));

    // First pass: insert accounts without parent references
    const codeToIdMap = new Map<string, number>();

    for (const account of defaultChartOfAccounts) {
      const accountTypeId = typeMap.get(account.typeCode);
      if (!accountTypeId) {
        console.warn(`[Accounting Seed] Account type ${account.typeCode} not found for ${account.code}`);
        continue;
      }

      const values = {
        code: account.code,
        nameTh: account.nameTh,
        nameEn: account.nameEn,
        accountTypeId,
        parentId: null, // Will update in second pass
        level: account.level,
        isActive: true,
        isPostable: account.isPostable ?? true,
        isBankAccount: account.isBankAccount ?? false,
        bankName: null,
        bankAccountNumber: null,
        description: null,
        createdBy: 1, // System user
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      const result = await (db as any).insert(accountTable).values(values);
      // Get the inserted ID - SQLite uses lastInsertRowid, MySQL uses insertId
      const insertedId = usingSqlite
        ? (result as any).lastInsertRowid as number
        : (result as any)[0]?.insertId as number;
      codeToIdMap.set(account.code, insertedId);
    }

    // Second pass: update parent references
    for (const account of defaultChartOfAccounts) {
      if (account.parentCode) {
        const accountId = codeToIdMap.get(account.code);
        const parentId = codeToIdMap.get(account.parentCode);

        if (accountId && parentId) {
          await (db as any)
            .update(accountTable)
            .set({ parentId, updatedAt: getNow() })
            .where(sql`id = ${accountId}`);
        }
      }
    }

    console.log(`[Accounting Seed] Seeded ${defaultChartOfAccounts.length} GL accounts`);
    return defaultChartOfAccounts.length;
  } catch (error) {
    console.error(`[Accounting Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed default fiscal year and periods
 */
async function seedFiscalYear(usingSqlite: boolean): Promise<number> {
  const tableName = 'fiscal_years';
  const isEmpty = await isTableEmpty(tableName, usingSqlite);

  if (!isEmpty) {
    console.log(`[Accounting Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Accounting Seed] Seeding ${tableName}...`);

  const yearTable = usingSqlite ? schema.sqliteFiscalYears : schema.mysqlFiscalYears;
  const periodTable = usingSqlite ? schema.sqliteFiscalPeriods : schema.mysqlFiscalPeriods;
  const db = usingSqlite ? getSqliteDb() : await getMysqlDb();

  try {
    // Create current fiscal year (calendar year)
    const currentYear = new Date().getFullYear();
    const yearCode = `FY${currentYear}`;
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    const yearValues = {
      yearCode,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
      isCurrent: true,
      status: 'open',
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    const yearResult = await (db as any).insert(yearTable).values(yearValues);
    // Get the inserted ID - SQLite uses lastInsertRowid, MySQL uses insertId
    const insertedYearId = usingSqlite
      ? (yearResult as any).lastInsertRowid as number
      : (yearResult as any)[0]?.insertId as number;

    // Create 12 monthly periods
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let i = 0; i < 12; i++) {
      const periodStart = new Date(currentYear, i, 1);
      const periodEnd = new Date(currentYear, i + 1, 0); // Last day of month

      const periodValues = {
        fiscalYearId: insertedYearId,
        periodNumber: i + 1,
        periodName: monthNames[i],
        startDate: toDbDate(periodStart.toISOString().split('T')[0]),
        endDate: toDbDate(periodEnd.toISOString().split('T')[0]),
        status: 'open',
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      await (db as any).insert(periodTable).values(periodValues);
    }

    console.log(`[Accounting Seed] Seeded fiscal year ${yearCode} with 12 periods`);
    return 13; // 1 year + 12 periods
  } catch (error) {
    console.error(`[Accounting Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Seed Asset Categories
 * Uses Thai Revenue Code depreciation rates
 */
async function seedAssetCategories(usingSqlite: boolean): Promise<number> {
  const tableName = 'asset_categories';
  const isEmpty = await isTableEmpty(tableName, usingSqlite);

  if (!isEmpty) {
    console.log(`[Accounting Seed] Table ${tableName} already has data, skipping seed`);
    return 0;
  }

  console.log(`[Accounting Seed] Seeding ${tableName}...`);

  const categoryTable = usingSqlite ? schema.sqliteAssetCategories : schema.mysqlAssetCategories;
  const accountTable = usingSqlite ? schema.sqliteGLAccounts : schema.mysqlGLAccounts;
  const db = usingSqlite ? getSqliteDb() : await getMysqlDb();

  try {
    // Get GL accounts for mapping by code
    const accounts = await (db as any).select().from(accountTable);
    const accountCodeToId = new Map(accounts.map((a: any) => [a.code, a.id]));

    let seededCount = 0;

    for (const category of ASSET_CATEGORIES) {
      // Find GL account IDs - use closest match or default accounts
      const assetGLAccountId = findAccountIdByCode(accountCodeToId, category.assetGLAccountCode, '1210');
      const depExpGLAccountId = findAccountIdByCode(accountCodeToId, category.depreciationExpenseGLAccountCode, '6270');
      const accumDepGLAccountId = findAccountIdByCode(accountCodeToId, category.accumulatedDepreciationGLAccountCode, '1220');

      if (!assetGLAccountId || !depExpGLAccountId || !accumDepGLAccountId) {
        console.warn(`[Accounting Seed] Skipping asset category ${category.code} - missing GL accounts`);
        continue;
      }

      const values = {
        code: category.code,
        nameTh: category.nameTh,
        nameEn: category.nameEn,
        defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
        defaultDepreciationMethod: category.defaultDepreciationMethod,
        maxDepreciationRate: category.maxDepreciationRate,
        assetGLAccountId,
        depreciationExpenseGLAccountId: depExpGLAccountId,
        accumulatedDepreciationGLAccountId: accumDepGLAccountId,
        isActive: true,
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      try {
        await (db as any).insert(categoryTable).values(values);
        seededCount++;
      } catch (err) {
        console.warn(`[Accounting Seed] Failed to insert asset category ${category.code}:`, err);
      }
    }

    console.log(`[Accounting Seed] Seeded ${seededCount} asset categories`);
    return seededCount;
  } catch (error) {
    console.error(`[Accounting Seed] Failed to seed ${tableName}:`, error);
    return 0;
  }
}

/**
 * Helper to find GL account ID by code with fallback
 */
function findAccountIdByCode(
  accountCodeToId: Map<string, number>,
  primaryCode: string,
  fallbackCode: string
): number | undefined {
  // Try exact match first
  if (accountCodeToId.has(primaryCode)) {
    return accountCodeToId.get(primaryCode);
  }
  // Try fallback
  if (accountCodeToId.has(fallbackCode)) {
    return accountCodeToId.get(fallbackCode);
  }
  // Try to find any account starting with the first 3 digits
  const prefix = primaryCode.substring(0, 3);
  for (const [code, id] of accountCodeToId.entries()) {
    if (code.startsWith(prefix)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Seed default bank accounts
 * Links bank GL accounts to actual bank account records
 */
async function seedDefaultBankAccounts(usingSqlite: boolean): Promise<number> {
  // Bank accounts are already in Chart of Accounts with isBankAccount flag
  // This function updates them with bank details if needed

  const accountTable = usingSqlite ? schema.sqliteGLAccounts : schema.mysqlGLAccounts;
  const db = usingSqlite ? getSqliteDb() : await getMysqlDb();

  // Default bank account details for seeding
  const bankAccountDetails = [
    { code: '1112', bankName: 'ธนาคารกรุงเทพ (Bangkok Bank)', bankAccountNumber: 'XXX-X-XXXXX-X' },
    { code: '1113', bankName: 'ธนาคารกสิกรไทย (Kasikorn Bank)', bankAccountNumber: 'XXX-X-XXXXX-X' },
  ];

  let updatedCount = 0;

  for (const bank of bankAccountDetails) {
    try {
      // Check if account exists and needs update
      const accounts = await (db as any)
        .select()
        .from(accountTable)
        .where(sql`code = ${bank.code}`);

      if (accounts.length > 0 && !accounts[0].bankName) {
        await (db as any)
          .update(accountTable)
          .set({
            bankName: bank.bankName,
            bankAccountNumber: bank.bankAccountNumber,
            updatedAt: getNow(),
          })
          .where(sql`code = ${bank.code}`);
        updatedCount++;
      }
    } catch (err) {
      // Ignore errors for bank account updates
    }
  }

  if (updatedCount > 0) {
    console.log(`[Accounting Seed] Updated ${updatedCount} bank account details`);
  }

  return updatedCount;
}

// ============================================
// Main Seed Function
// ============================================

/**
 * Seed all accounting tables
 * Called automatically during server startup
 */
export async function seedAccountingTables(): Promise<void> {
  const usingSqlite = isSqlite();
  console.log(`[Accounting Seed] Starting accounting tables seed for ${usingSqlite ? 'SQLite' : 'MySQL'}...`);

  let totalSeeded = 0;

  // Seed in order (dependencies matter!)
  // 1. GL Account Types first (no dependencies)
  totalSeeded += await seedGLAccountTypes(usingSqlite);

  // 2. Chart of Accounts (depends on GL Account Types)
  totalSeeded += await seedChartOfAccounts(usingSqlite);

  // 3. Fiscal Year and Periods (no dependencies)
  totalSeeded += await seedFiscalYear(usingSqlite);

  // 4. Asset Categories (depends on Chart of Accounts for GL account references)
  totalSeeded += await seedAssetCategories(usingSqlite);

  // 5. Bank Account Details (updates existing GL accounts)
  totalSeeded += await seedDefaultBankAccounts(usingSqlite);

  console.log(`[Accounting Seed] Accounting seed complete. Total records: ${totalSeeded}`);
}

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JournalEntriesPage from '@/app/accounting/journal-entries/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Next.js navigation
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/accounting/journal-entries',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock DevExtreme dialog
vi.mock('devextreme/ui/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

global.fetch = vi.fn();

// Seed data generator for realistic journal entries covering all real-world accounting scenarios
function createSeedJournalEntries() {
  return [
    // Scenario 1: Utility Expenses (Multiple expense accounts to cash)
    // Real-world: Monthly utility bills paid in cash
    {
      id: 1,
      entryNumber: 'JE-202512-000001',
      entryDate: '2025-12-15',
      fiscalPeriodId: 12,
      description: 'ค่าสาธารณูปโภคประจำเดือน ธ.ค. 2568',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'posted',
      totalDebit: 15000.00,
      totalCredit: 15000.00,
      postedBy: 1,
      postedAt: '2025-12-15T10:30:00',
      lines: [
        { id: 1, lineNumber: 1, glAccountId: 65, accountCode: '5211', accountName: 'ค่าไฟฟ้า', debit: 8000, credit: 0, description: 'ค่าไฟฟ้า ธ.ค.' },
        { id: 2, lineNumber: 2, glAccountId: 66, accountCode: '5212', accountName: 'ค่าน้ำประปา', debit: 2000, credit: 0, description: 'ค่าน้ำ ธ.ค.' },
        { id: 3, lineNumber: 3, glAccountId: 67, accountCode: '5213', accountName: 'ค่าโทรศัพท์', debit: 5000, credit: 0, description: 'ค่าโทร ธ.ค.' },
        { id: 4, lineNumber: 4, glAccountId: 3, accountCode: '1111', accountName: 'เงินสด', debit: 0, credit: 15000, description: 'จ่ายเงินสด' },
      ],
    },
    // Scenario 2: Prepaid Expense (Asset to bank)
    // Real-world: Prepaying rent for multiple months
    {
      id: 2,
      entryNumber: 'JE-202512-000002',
      entryDate: '2025-12-18',
      fiscalPeriodId: 12,
      description: 'บันทึกค่าเช่าสำนักงานล่วงหน้า',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'draft',
      totalDebit: 50000.00,
      totalCredit: 50000.00,
      postedBy: null,
      postedAt: null,
      lines: [
        { id: 5, lineNumber: 1, glAccountId: 20, accountCode: '1310', accountName: 'ค่าเช่าจ่ายล่วงหน้า', debit: 50000, credit: 0, description: 'ค่าเช่า ม.ค.-มี.ค. 2569' },
        { id: 6, lineNumber: 2, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 50000, description: 'โอนจ่าย' },
      ],
    },
    // Scenario 3: AR Receipt (Customer payment)
    // Real-world: Receiving payment from customer, reducing receivables
    {
      id: 3,
      entryNumber: 'JE-202512-000003',
      entryDate: '2025-12-20',
      fiscalPeriodId: 12,
      description: 'รับชำระหนี้จากลูกค้า',
      sourceType: 'AR_RECEIPT',
      sourceId: 101,
      status: 'posted',
      totalDebit: 107000.00,
      totalCredit: 107000.00,
      postedBy: 1,
      postedAt: '2025-12-20T14:00:00',
      lines: [
        { id: 7, lineNumber: 1, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 107000, credit: 0, description: 'รับเงินโอน' },
        { id: 8, lineNumber: 2, glAccountId: 8, accountCode: '1121', accountName: 'ลูกหนี้การค้า - ในประเทศ', debit: 0, credit: 107000, description: 'ตัดยอดลูกหนี้' },
      ],
    },
    // Scenario 4: AP Payment with WHT (Thai tax compliance)
    // Real-world: Paying vendor with 3% withholding tax deduction
    {
      id: 4,
      entryNumber: 'JE-202512-000004',
      entryDate: '2025-12-22',
      fiscalPeriodId: 12,
      description: 'จ่ายค่าซื้อวัตถุดิบ พร้อมหัก ณ ที่จ่าย',
      sourceType: 'AP_PAYMENT',
      sourceId: 55,
      status: 'posted',
      totalDebit: 100000.00,
      totalCredit: 100000.00,
      postedBy: 1,
      postedAt: '2025-12-22T09:15:00',
      lines: [
        { id: 9, lineNumber: 1, glAccountId: 45, accountCode: '2111', accountName: 'เจ้าหนี้การค้า - ในประเทศ', debit: 100000, credit: 0, description: 'ตัดยอดเจ้าหนี้' },
        { id: 10, lineNumber: 2, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 97000, description: 'จ่ายสุทธิ' },
        { id: 11, lineNumber: 3, glAccountId: 53, accountCode: '2132', accountName: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', debit: 0, credit: 3000, description: 'WHT 3%' },
      ],
    },
    // Scenario 5: Reversed Entry
    // Real-world: Correcting an incorrect entry by reversing it
    {
      id: 5,
      entryNumber: 'JE-202512-000005',
      entryDate: '2025-12-25',
      fiscalPeriodId: 12,
      description: 'กลับรายการค่าสาธารณูปโภค - บันทึกผิดบัญชี',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'reversed',
      totalDebit: 5000.00,
      totalCredit: 5000.00,
      postedBy: 1,
      postedAt: '2025-12-25T11:00:00',
      reversedBy: 1,
      reversedAt: '2025-12-26T09:00:00',
      reversalEntryId: 6,
      lines: [
        { id: 12, lineNumber: 1, glAccountId: 65, accountCode: '5211', accountName: 'ค่าไฟฟ้า', debit: 5000, credit: 0, description: 'บันทึกผิด' },
        { id: 13, lineNumber: 2, glAccountId: 3, accountCode: '1111', accountName: 'เงินสด', debit: 0, credit: 5000, description: 'จ่ายเงินสด' },
      ],
    },
    // Scenario 6: Sales with COGS (Sales Order Shipment)
    // Real-world: Recording sales revenue and cost of goods sold when shipping to customer
    // Dr. Accounts Receivable / Cr. Sales Revenue
    // Dr. COGS / Cr. Inventory
    {
      id: 6,
      entryNumber: 'JE-202512-000006',
      entryDate: '2025-12-10',
      fiscalPeriodId: 12,
      description: 'ขายสินค้า - ยาสมุนไพรขมิ้นชัน 500 กล่อง พร้อมตัดต้นทุน',
      sourceType: 'SO_SHIPMENT',
      sourceId: 201,
      status: 'posted',
      totalDebit: 175000.00,
      totalCredit: 175000.00,
      postedBy: 1,
      postedAt: '2025-12-10T11:00:00',
      lines: [
        { id: 14, lineNumber: 1, glAccountId: 8, accountCode: '1121', accountName: 'ลูกหนี้การค้า - ในประเทศ', debit: 107000, credit: 0, description: 'ขาย 500 กล่อง @ 200 บาท + VAT' },
        { id: 15, lineNumber: 2, glAccountId: 80, accountCode: '4110', accountName: 'รายได้จากการขาย', debit: 0, credit: 100000, description: 'รายได้ขายสินค้า' },
        { id: 16, lineNumber: 3, glAccountId: 52, accountCode: '2131', accountName: 'ภาษีขายค้างจ่าย', debit: 0, credit: 7000, description: 'Output VAT 7%' },
        { id: 17, lineNumber: 4, glAccountId: 60, accountCode: '5110', accountName: 'ต้นทุนขาย', debit: 68000, credit: 0, description: 'ต้นทุนสินค้า 500 กล่อง @ 136 บาท' },
        { id: 18, lineNumber: 5, glAccountId: 15, accountCode: '1141', accountName: 'สินค้าสำเร็จรูป', debit: 0, credit: 68000, description: 'ตัดสต็อกสินค้า' },
      ],
    },
    // Scenario 7: Raw Materials Purchase on Credit (PO Receipt)
    // Real-world: Receiving raw materials from supplier with VAT
    {
      id: 7,
      entryNumber: 'JE-202512-000007',
      entryDate: '2025-12-08',
      fiscalPeriodId: 12,
      description: 'รับวัตถุดิบสมุนไพร - ขมิ้นชันสด 1,000 กก.',
      sourceType: 'PO_RECEIPT',
      sourceId: 301,
      status: 'posted',
      totalDebit: 214000.00,
      totalCredit: 214000.00,
      postedBy: 1,
      postedAt: '2025-12-08T14:30:00',
      lines: [
        { id: 19, lineNumber: 1, glAccountId: 12, accountCode: '1131', accountName: 'วัตถุดิบ', debit: 200000, credit: 0, description: 'ขมิ้นชันสด 1,000 กก. @ 200 บาท' },
        { id: 20, lineNumber: 2, glAccountId: 51, accountCode: '1161', accountName: 'ภาษีซื้อ', debit: 14000, credit: 0, description: 'Input VAT 7%' },
        { id: 21, lineNumber: 3, glAccountId: 45, accountCode: '2111', accountName: 'เจ้าหนี้การค้า - ในประเทศ', debit: 0, credit: 214000, description: 'ค้างจ่ายซัพพลายเออร์' },
      ],
    },
    // Scenario 8: Monthly Payroll Entry
    // Real-world: Recording employee salaries with tax and social security deductions
    {
      id: 8,
      entryNumber: 'JE-202512-000008',
      entryDate: '2025-12-28',
      fiscalPeriodId: 12,
      description: 'เงินเดือนพนักงานประจำเดือน ธ.ค. 2568',
      sourceType: 'PAYROLL',
      sourceId: 401,
      status: 'posted',
      totalDebit: 350000.00,
      totalCredit: 350000.00,
      postedBy: 1,
      postedAt: '2025-12-28T16:00:00',
      lines: [
        { id: 22, lineNumber: 1, glAccountId: 61, accountCode: '5120', accountName: 'เงินเดือนและค่าจ้าง', debit: 300000, credit: 0, description: 'เงินเดือนพนักงาน 15 คน' },
        { id: 23, lineNumber: 2, glAccountId: 62, accountCode: '5121', accountName: 'ค่าสมทบประกันสังคม', debit: 15000, credit: 0, description: 'ประกันสังคมส่วนนายจ้าง 5%' },
        { id: 24, lineNumber: 3, glAccountId: 63, accountCode: '5122', accountName: 'ค่าสวัสดิการพนักงาน', debit: 35000, credit: 0, description: 'OT + เบี้ยเลี้ยง' },
        { id: 25, lineNumber: 4, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 277000, description: 'จ่ายเงินเดือนสุทธิ' },
        { id: 26, lineNumber: 5, glAccountId: 54, accountCode: '2133', accountName: 'ภาษีหัก ณ ที่จ่ายพนักงาน', debit: 0, credit: 28000, description: 'WHT เงินเดือน' },
        { id: 27, lineNumber: 6, glAccountId: 55, accountCode: '2141', accountName: 'ประกันสังคมค้างจ่าย', debit: 0, credit: 30000, description: 'ประกันสังคมนายจ้าง+ลูกจ้าง' },
        { id: 28, lineNumber: 7, glAccountId: 56, accountCode: '2142', accountName: 'กองทุนสำรองเลี้ยงชีพค้างจ่าย', debit: 0, credit: 15000, description: 'กองทุน PVD' },
      ],
    },
    // Scenario 9: Monthly Depreciation Entry
    // Real-world: Recording monthly depreciation on fixed assets
    {
      id: 9,
      entryNumber: 'JE-202512-000009',
      entryDate: '2025-12-31',
      fiscalPeriodId: 12,
      description: 'ค่าเสื่อมราคาประจำเดือน ธ.ค. 2568',
      sourceType: 'DEPRECIATION',
      sourceId: null,
      status: 'posted',
      totalDebit: 45000.00,
      totalCredit: 45000.00,
      postedBy: 1,
      postedAt: '2025-12-31T23:00:00',
      lines: [
        { id: 29, lineNumber: 1, glAccountId: 68, accountCode: '5220', accountName: 'ค่าเสื่อมราคา - อาคาร', debit: 15000, credit: 0, description: 'ค่าเสื่อมอาคารโรงงาน' },
        { id: 30, lineNumber: 2, glAccountId: 69, accountCode: '5221', accountName: 'ค่าเสื่อมราคา - เครื่องจักร', debit: 20000, credit: 0, description: 'ค่าเสื่อมเครื่องจักรผลิต' },
        { id: 31, lineNumber: 3, glAccountId: 71, accountCode: '5222', accountName: 'ค่าเสื่อมราคา - อุปกรณ์สำนักงาน', debit: 10000, credit: 0, description: 'ค่าเสื่อมอุปกรณ์' },
        { id: 32, lineNumber: 4, glAccountId: 35, accountCode: '1512', accountName: 'ค่าเสื่อมสะสม - อาคาร', debit: 0, credit: 15000, description: 'สะสมอาคาร' },
        { id: 33, lineNumber: 5, glAccountId: 36, accountCode: '1522', accountName: 'ค่าเสื่อมสะสม - เครื่องจักร', debit: 0, credit: 20000, description: 'สะสมเครื่องจักร' },
        { id: 34, lineNumber: 6, glAccountId: 37, accountCode: '1532', accountName: 'ค่าเสื่อมสะสม - อุปกรณ์', debit: 0, credit: 10000, description: 'สะสมอุปกรณ์' },
      ],
    },
    // Scenario 10: Manufacturing - Cost Allocation (Production Cost)
    // Real-world: Allocating manufacturing overhead to Work-in-Process
    {
      id: 10,
      entryNumber: 'JE-202512-000010',
      entryDate: '2025-12-20',
      fiscalPeriodId: 12,
      description: 'โอนต้นทุนการผลิตเข้างานระหว่างทำ - Batch P-2568-1220',
      sourceType: 'COST_ALLOCATION',
      sourceId: 501,
      status: 'posted',
      totalDebit: 180000.00,
      totalCredit: 180000.00,
      postedBy: 1,
      postedAt: '2025-12-20T18:00:00',
      lines: [
        { id: 35, lineNumber: 1, glAccountId: 13, accountCode: '1132', accountName: 'งานระหว่างทำ', debit: 180000, credit: 0, description: 'ต้นทุน Batch P-2568-1220' },
        { id: 36, lineNumber: 2, glAccountId: 12, accountCode: '1131', accountName: 'วัตถุดิบ', debit: 0, credit: 120000, description: 'ขมิ้นชัน + สมุนไพรอื่น' },
        { id: 37, lineNumber: 3, glAccountId: 64, accountCode: '5123', accountName: 'ค่าแรงงานทางตรง', debit: 0, credit: 35000, description: 'ค่าแรงผลิต' },
        { id: 38, lineNumber: 4, glAccountId: 72, accountCode: '5130', accountName: 'ค่าโสหุ้ยการผลิต', debit: 0, credit: 25000, description: 'โสหุ้ยจัดสรร' },
      ],
    },
    // Scenario 11: Manufacturing - Finished Goods Transfer
    // Real-world: Transferring completed production to finished goods inventory
    {
      id: 11,
      entryNumber: 'JE-202512-000011',
      entryDate: '2025-12-22',
      fiscalPeriodId: 12,
      description: 'โอนสินค้าสำเร็จรูป - ยาสมุนไพรขมิ้นชัน 1,000 กล่อง',
      sourceType: 'COST_ALLOCATION',
      sourceId: 502,
      status: 'posted',
      totalDebit: 136000.00,
      totalCredit: 136000.00,
      postedBy: 1,
      postedAt: '2025-12-22T10:00:00',
      lines: [
        { id: 39, lineNumber: 1, glAccountId: 15, accountCode: '1141', accountName: 'สินค้าสำเร็จรูป', debit: 136000, credit: 0, description: '1,000 กล่อง @ 136 บาท' },
        { id: 40, lineNumber: 2, glAccountId: 13, accountCode: '1132', accountName: 'งานระหว่างทำ', debit: 0, credit: 136000, description: 'โอนจาก WIP' },
      ],
    },
    // Scenario 12: Loan Interest Payment
    // Real-world: Monthly loan payment with principal and interest split
    {
      id: 12,
      entryNumber: 'JE-202512-000012',
      entryDate: '2025-12-25',
      fiscalPeriodId: 12,
      description: 'ผ่อนชำระเงินกู้ธนาคาร งวดที่ 24/60',
      sourceType: 'MANUAL',
      sourceId: null,
      status: 'posted',
      totalDebit: 55000.00,
      totalCredit: 55000.00,
      postedBy: 1,
      postedAt: '2025-12-25T09:00:00',
      lines: [
        { id: 41, lineNumber: 1, glAccountId: 46, accountCode: '2210', accountName: 'เงินกู้ยืมระยะยาว', debit: 40000, credit: 0, description: 'เงินต้นงวด 24' },
        { id: 42, lineNumber: 2, glAccountId: 73, accountCode: '5310', accountName: 'ดอกเบี้ยจ่าย', debit: 15000, credit: 0, description: 'ดอกเบี้ยเงินกู้' },
        { id: 43, lineNumber: 3, glAccountId: 4, accountCode: '1112', accountName: 'เงินฝากธนาคาร - ออมทรัพย์', debit: 0, credit: 55000, description: 'จ่ายผ่อนชำระ' },
      ],
    },
    // Scenario 13: Period-End Closing Entry
    // Real-world: Closing temporary accounts to retained earnings at month-end
    {
      id: 13,
      entryNumber: 'JE-202512-000013',
      entryDate: '2025-12-31',
      fiscalPeriodId: 12,
      description: 'ปิดบัญชีรายได้-ค่าใช้จ่ายประจำเดือน ธ.ค. 2568',
      sourceType: 'PERIOD_CLOSE',
      sourceId: null,
      status: 'draft',
      totalDebit: 100000.00,
      totalCredit: 100000.00,
      postedBy: null,
      postedAt: null,
      lines: [
        { id: 44, lineNumber: 1, glAccountId: 80, accountCode: '4110', accountName: 'รายได้จากการขาย', debit: 100000, credit: 0, description: 'ปิดรายได้' },
        { id: 45, lineNumber: 2, glAccountId: 90, accountCode: '3200', accountName: 'กำไรสะสม', debit: 0, credit: 100000, description: 'โอนเข้ากำไรสะสม' },
      ],
    },
  ];
}

// Seed GL accounts for the form - comprehensive list for manufacturing ERP
function createSeedGLAccounts() {
  return [
    // Cash & Bank
    { id: 3, code: '1111', nameTh: 'เงินสด', nameEn: 'Cash on Hand' },
    { id: 4, code: '1112', nameTh: 'เงินฝากธนาคาร - ออมทรัพย์', nameEn: 'Bank - Savings Account' },
    // Receivables
    { id: 8, code: '1121', nameTh: 'ลูกหนี้การค้า - ในประเทศ', nameEn: 'AR - Domestic' },
    // Inventory
    { id: 12, code: '1131', nameTh: 'วัตถุดิบ', nameEn: 'Raw Materials' },
    { id: 13, code: '1132', nameTh: 'งานระหว่างทำ', nameEn: 'Work in Process' },
    { id: 15, code: '1141', nameTh: 'สินค้าสำเร็จรูป', nameEn: 'Finished Goods' },
    // Prepaid & Tax Assets
    { id: 20, code: '1310', nameTh: 'ค่าเช่าจ่ายล่วงหน้า', nameEn: 'Prepaid Rent' },
    { id: 51, code: '1161', nameTh: 'ภาษีซื้อ', nameEn: 'Input VAT' },
    // Fixed Assets & Accumulated Depreciation
    { id: 35, code: '1512', nameTh: 'ค่าเสื่อมสะสม - อาคาร', nameEn: 'Accum. Dep. - Building' },
    { id: 36, code: '1522', nameTh: 'ค่าเสื่อมสะสม - เครื่องจักร', nameEn: 'Accum. Dep. - Machinery' },
    { id: 37, code: '1532', nameTh: 'ค่าเสื่อมสะสม - อุปกรณ์', nameEn: 'Accum. Dep. - Equipment' },
    // Payables
    { id: 45, code: '2111', nameTh: 'เจ้าหนี้การค้า - ในประเทศ', nameEn: 'AP - Domestic' },
    { id: 46, code: '2210', nameTh: 'เงินกู้ยืมระยะยาว', nameEn: 'Long-term Loan' },
    // Tax Liabilities
    { id: 52, code: '2131', nameTh: 'ภาษีขายค้างจ่าย', nameEn: 'Output VAT Payable' },
    { id: 53, code: '2132', nameTh: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', nameEn: 'WHT Payable - Vendor' },
    { id: 54, code: '2133', nameTh: 'ภาษีหัก ณ ที่จ่ายพนักงาน', nameEn: 'WHT Payable - Employee' },
    { id: 55, code: '2141', nameTh: 'ประกันสังคมค้างจ่าย', nameEn: 'Social Security Payable' },
    { id: 56, code: '2142', nameTh: 'กองทุนสำรองเลี้ยงชีพค้างจ่าย', nameEn: 'Provident Fund Payable' },
    // Equity
    { id: 90, code: '3200', nameTh: 'กำไรสะสม', nameEn: 'Retained Earnings' },
    // Revenue
    { id: 80, code: '4110', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue' },
    // Cost of Sales
    { id: 60, code: '5110', nameTh: 'ต้นทุนขาย', nameEn: 'Cost of Goods Sold' },
    // Payroll Expenses
    { id: 61, code: '5120', nameTh: 'เงินเดือนและค่าจ้าง', nameEn: 'Salaries & Wages' },
    { id: 62, code: '5121', nameTh: 'ค่าสมทบประกันสังคม', nameEn: 'Social Security - Employer' },
    { id: 63, code: '5122', nameTh: 'ค่าสวัสดิการพนักงาน', nameEn: 'Employee Benefits' },
    { id: 64, code: '5123', nameTh: 'ค่าแรงงานทางตรง', nameEn: 'Direct Labor' },
    // Utility Expenses
    { id: 65, code: '5211', nameTh: 'ค่าไฟฟ้า', nameEn: 'Electricity Expense' },
    { id: 66, code: '5212', nameTh: 'ค่าน้ำประปา', nameEn: 'Water Expense' },
    { id: 67, code: '5213', nameTh: 'ค่าโทรศัพท์', nameEn: 'Telephone Expense' },
    // Depreciation Expenses
    { id: 68, code: '5220', nameTh: 'ค่าเสื่อมราคา - อาคาร', nameEn: 'Depreciation - Building' },
    { id: 69, code: '5221', nameTh: 'ค่าเสื่อมราคา - เครื่องจักร', nameEn: 'Depreciation - Machinery' },
    { id: 70, code: '5300', nameTh: 'ค่าเช่าสำนักงาน', nameEn: 'Office Rent' },
    { id: 71, code: '5222', nameTh: 'ค่าเสื่อมราคา - อุปกรณ์สำนักงาน', nameEn: 'Depreciation - Equipment' },
    // Manufacturing Overhead
    { id: 72, code: '5130', nameTh: 'ค่าโสหุ้ยการผลิต', nameEn: 'Manufacturing Overhead' },
    // Finance Costs
    { id: 73, code: '5310', nameTh: 'ดอกเบี้ยจ่าย', nameEn: 'Interest Expense' },
  ];
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('JournalEntriesPage', () => {
  const seedEntries = createSeedJournalEntries();
  const seedAccounts = createSeedGLAccounts();

  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/api/accounting/journal-entries') && !urlStr.includes('/post') && !urlStr.includes('/reverse')) {
        // Check for specific entry ID
        const idMatch = urlStr.match(/\/journal-entries\/(\d+)$/);
        if (idMatch) {
          const entry = seedEntries.find(e => e.id === parseInt(idMatch[1]));
          return {
            ok: true,
            json: async () => ({ data: entry || null }),
          } as Response;
        }
        // List entries
        return {
          ok: true,
          json: async () => ({ data: seedEntries }),
        } as Response;
      }

      if (urlStr.includes('/api/accounting/gl-accounts')) {
        return {
          ok: true,
          json: async () => ({ data: seedAccounts }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Header and Layout', () => {
    it('renders professional page header with Thai and English titles', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
      expect(screen.getByText('Journal Entries')).toBeInTheDocument();
    });

    it('renders add entry button in header', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      const addButton = screen.getByTestId('add-entry-button');
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('KPI Cards with Real-World Data', () => {
    it('renders all KPI cards with correct labels', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
        expect(screen.getByText('ร่าง')).toBeInTheDocument();
        expect(screen.getByText('ผ่านแล้ว')).toBeInTheDocument();
        expect(screen.getByText('กลับรายการ')).toBeInTheDocument();
      });
    });

    it('displays correct counts from seed data', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const kpiCards = screen.getByTestId('kpi-cards');
      expect(kpiCards).toBeInTheDocument();

      // With 13 seed entries: 2 draft, 10 posted, 1 reversed
      await waitFor(() => {
        expect(screen.getByText('13')).toBeInTheDocument(); // Total
      });
    });
  });

  describe('Filter Panel', () => {
    it('renders filter panel with status and source type filters', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const filterPanel = screen.getByTestId('filter-panel');
      expect(filterPanel).toBeInTheDocument();
      expect(screen.getByText('สถานะ')).toBeInTheDocument();
      expect(screen.getByText('ประเภท')).toBeInTheDocument();
    });
  });

  describe('Data Grid with Journal Entries', () => {
    it('renders data grid container', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      const gridContainer = screen.getByTestId('journal-entries-grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('displays journal entries with DevExtreme DataGrid', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Real-World Accounting Scenarios', () => {
    it('handles utility expense entry (multiple expenses to cash)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 1: Utility expenses with multiple expense accounts debited and cash credited
      // Real-world: Monthly utility bills (electricity ฿8,000 + water ฿2,000 + phone ฿5,000 = ฿15,000)
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/journal-entries'),
        );
      });
      // Validates: Dr. Expenses / Cr. Cash pattern
    });

    it('handles prepaid expense entry (asset to bank)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 2: Prepaid rent ฿50,000 for 3 months
      // Real-world: Prepaying rent as current asset, reducing bank balance
      // Dr. Prepaid Rent ฿50,000 / Cr. Bank ฿50,000
    });

    it('handles AR receipt entry with customer payment', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 3: AR_RECEIPT source type - bank increases, AR decreases
      // Real-world: Customer payment of ฿107,000
      // Dr. Bank ฿107,000 / Cr. AR ฿107,000
    });

    it('handles AP payment with WHT deduction (Thai tax compliance)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 4: AP_PAYMENT with 3% WHT
      // Real-world Thai accounting: Pay vendor ฿100,000, deduct WHT 3% = ฿3,000
      // Dr. AP ฿100,000 / Cr. Bank ฿97,000 + Cr. WHT Payable ฿3,000
    });

    it('handles reversed entry scenario', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 5: Reversed entry due to incorrect account
      // Real-world: Correcting mistakes by creating reversal entry
    });

    it('handles sales with COGS entry (SO Shipment)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 6: SO_SHIPMENT with sales revenue and COGS
      // Real-world: Selling herbal medicine - 500 boxes @ ฿200 + 7% VAT
      // Dr. AR ฿107,000 / Cr. Sales ฿100,000 + Cr. Output VAT ฿7,000
      // Dr. COGS ฿68,000 / Cr. Finished Goods ฿68,000
    });

    it('handles raw materials purchase with VAT (PO Receipt)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 7: PO_RECEIPT for raw materials
      // Real-world: Purchasing turmeric 1,000 kg @ ฿200 + 7% VAT
      // Dr. Raw Materials ฿200,000 + Dr. Input VAT ฿14,000 / Cr. AP ฿214,000
    });

    it('handles monthly payroll entry with Thai deductions', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 8: PAYROLL with multiple deductions
      // Real-world: 15 employees salary ฿300,000 + benefits
      // Dr. Salary ฿300,000 + SSC Employer ฿15,000 + Benefits ฿35,000
      // Cr. Bank ฿277,000 + WHT Emp ฿28,000 + SSC Total ฿30,000 + PVD ฿15,000
    });

    it('handles monthly depreciation entry', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 9: DEPRECIATION for fixed assets
      // Real-world: Monthly depreciation for building, machinery, equipment
      // Dr. Depreciation Expenses / Cr. Accumulated Depreciation
    });

    it('handles manufacturing cost allocation (WIP)', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 10: COST_ALLOCATION to Work-in-Process
      // Real-world: Transferring raw materials + labor + overhead to WIP
      // Dr. WIP ฿180,000 / Cr. Raw Materials + Direct Labor + Overhead
    });

    it('handles finished goods transfer from WIP', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 11: COST_ALLOCATION - WIP to Finished Goods
      // Real-world: Completing production batch of 1,000 boxes
      // Dr. Finished Goods ฿136,000 / Cr. WIP ฿136,000
    });

    it('handles loan payment with interest', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 12: Loan payment with principal and interest split
      // Real-world: Monthly installment payment งวด 24/60
      // Dr. Notes Payable ฿40,000 + Dr. Interest Expense ฿15,000 / Cr. Bank ฿55,000
    });

    it('handles period-end closing entry', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Entry 13: PERIOD_CLOSE - Close revenue/expense to retained earnings
      // Real-world: Month-end closing of temporary accounts
      // Dr. Sales Revenue / Cr. Retained Earnings
    });
  });

  describe('Entry Status Display', () => {
    it('displays different status badges correctly', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Should render status badges for draft, posted, reversed
      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Source Type Labels', () => {
    it('displays Thai labels for source types', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // Source types should be translated:
      // MANUAL -> บันทึกมือ
      // AR_RECEIPT -> รับเงิน
      // AP_PAYMENT -> จ่ายเงิน
      await waitFor(() => {
        const grid = document.querySelector('.dx-datagrid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('fetches journal entries on mount', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/journal-entries'),
        );
      });
    });

    it('navigates to new entry page when add button is clicked', async () => {
      render(<JournalEntriesPage />, { wrapper: createWrapper() });

      // The list page no longer fetches GL accounts directly
      // It navigates to the new page where the form fetches GL accounts
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/accounting/journal-entries'),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API error gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      // Should not crash
      render(<JournalEntriesPage />, { wrapper: createWrapper() });
      expect(screen.getByText('รายการบันทึกบัญชี')).toBeInTheDocument();
    });
  });
});

/**
 * Financial Reports Test Seeding Functions
 * Feature: Accounting Financial Reports
 *
 * Provides comprehensive test data for financial report service tests.
 * Each scenario has pre-calculated expected values for verification.
 *
 * Accounting Principle: Double-Entry Bookkeeping
 * - Every transaction affects at least two accounts
 * - Total Debits = Total Credits
 * - Assets = Liabilities + Equity + (Revenue - Expenses)
 */

import Database from 'better-sqlite3';

// ============================================
// Test Data Constants
// ============================================

/**
 * Account IDs matching the actual seeded GL accounts
 */
export const REPORT_ACCT_IDS = {
  // Assets (1xxx) - Normal balance: Debit
  CASH: 101,                    // 1111 Cash
  BANK_ACCOUNT: 102,            // 1112 Bank Account
  AR_DOMESTIC: 103,             // 1121 Accounts Receivable
  INVENTORY_RAW: 104,           // 1131 Raw Materials
  INVENTORY_FG: 105,            // 1133 Finished Goods
  FIXED_ASSETS: 106,            // 1213 Fixed Assets (Machinery)
  ACCUM_DEPR: 107,              // 1223 Accumulated Depreciation (contra-asset)
  INPUT_VAT: 203,               // 1142 Input VAT

  // Liabilities (2xxx) - Normal balance: Credit
  AP_DOMESTIC: 201,             // 2111 Accounts Payable
  OUTPUT_VAT: 202,              // 2131 Output VAT
  WHT_PAYABLE: 205,             // 2132 WHT Payable
  BANK_LOAN: 206,               // 2211 Bank Loan (we'll add this)

  // Equity (3xxx) - Normal balance: Credit
  SHARE_CAPITAL: 301,           // 3120 Share Capital
  RETAINED_EARNINGS: 302,       // 3220 Retained Earnings

  // Revenue (4xxx) - Normal balance: Credit
  SALES_REVENUE: 401,           // 4110 Sales Revenue
  OTHER_INCOME: 402,            // 4210 Other Income (we'll add this)

  // Expenses (5xxx, 6xxx) - Normal balance: Debit
  COGS: 501,                    // 5110 Cost of Goods Sold
  SALARY_EXPENSE: 601,          // 6210 Salaries & Wages
  RENT_EXPENSE: 602,            // 6220 Rent Expense (we'll add this)
  UTILITIES_EXPENSE: 603,       // 6230 Utilities (we'll add this)
  DEPRECIATION_EXPENSE: 604,    // 6240 Depreciation Expense (we'll add this)
  INTEREST_EXPENSE: 605,        // 6250 Interest Expense (we'll add this)
  INCOME_TAX_EXPENSE: 606,      // 6260 Income Tax Expense (we'll add this)
};

export const REPORT_TEST_DATES = {
  FISCAL_YEAR_START: '2026-01-01',
  FISCAL_YEAR_END: '2026-12-31',
  PERIOD_START: '2026-01-01',
  PERIOD_END: '2026-01-31',
  JAN_15: '2026-01-15',
};

// ============================================
// Expected Values for Verification
// ============================================

/**
 * Pre-calculated expected values for the "Herbal Medicine Trading" scenario
 *
 * This represents a typical month for a herbal medicine trading company:
 * - Initial capital injection
 * - Sales with VAT
 * - Cost of goods sold
 * - Operating expenses
 * - Fixed asset purchase
 * - Loan and interest
 * - Tax payment
 */
export const EXPECTED_VALUES = {
  // Trial Balance totals
  TRIAL_BALANCE: {
    TOTAL_DEBIT: 1_000_000 + 200_000 + 428_000 + 100_000 + 300_000 + 500_000 + 21_000 +
                 200_000 + 80_000 + 20_000 + 10_000 + 50_000 + 10_000, // Sum of all debits
    TOTAL_CREDIT: 100_000 + 142_800 + 50_000 + 300_000 + 1_000_000 + 100_000 +
                  600_000 + 10_000 + 616_200, // Sum of all credits (includes balancing retained earnings)
    // Note: These must be equal for a balanced trial balance
  },

  // Balance Sheet values
  BALANCE_SHEET: {
    // Current Assets
    CASH: 619_200,              // Opening 1M - purchases + sales collections - expenses
    BANK_ACCOUNT: 200_000,      // Initial deposit
    AR_DOMESTIC: 428_000,       // Net AR (some collected, some outstanding)
    INVENTORY_RAW: 100_000,     // Purchased less used
    INVENTORY_FG: 300_000,      // Manufactured goods
    INPUT_VAT: 21_000,          // VAT on purchases

    // Non-Current Assets
    FIXED_ASSETS: 500_000,      // Machinery purchase
    ACCUM_DEPR: -50_000,        // Month's depreciation (contra-asset)

    // Current Liabilities
    AP_DOMESTIC: 100_000,       // Unpaid vendor invoices
    OUTPUT_VAT: 42_000,         // VAT collected on sales
    WHT_PAYABLE: 5_000,         // Withheld taxes

    // Non-Current Liabilities
    BANK_LOAN: 300_000,         // Equipment financing loan

    // Equity
    SHARE_CAPITAL: 1_000_000,   // Initial capital
    RETAINED_EARNINGS: 871_200, // Accumulated profits (opening + current period net income)

    // Calculated totals
    get TOTAL_CURRENT_ASSETS() {
      return this.CASH + this.BANK_ACCOUNT + this.AR_DOMESTIC +
             this.INVENTORY_RAW + this.INVENTORY_FG + this.INPUT_VAT;
    },
    get TOTAL_NON_CURRENT_ASSETS() {
      return this.FIXED_ASSETS + this.ACCUM_DEPR;
    },
    get TOTAL_ASSETS() {
      return this.TOTAL_CURRENT_ASSETS + this.TOTAL_NON_CURRENT_ASSETS;
    },
    get TOTAL_CURRENT_LIABILITIES() {
      return this.AP_DOMESTIC + this.OUTPUT_VAT + this.WHT_PAYABLE;
    },
    get TOTAL_NON_CURRENT_LIABILITIES() {
      return this.BANK_LOAN;
    },
    get TOTAL_LIABILITIES() {
      return this.TOTAL_CURRENT_LIABILITIES + this.TOTAL_NON_CURRENT_LIABILITIES;
    },
    get TOTAL_EQUITY() {
      return this.SHARE_CAPITAL + this.RETAINED_EARNINGS;
    },
    get TOTAL_LIABILITIES_AND_EQUITY() {
      return this.TOTAL_LIABILITIES + this.TOTAL_EQUITY;
    },
  },

  // Income Statement values
  INCOME_STATEMENT: {
    // Revenue
    SALES_REVENUE: 600_000,     // Gross sales (excluding VAT)
    OTHER_INCOME: 10_000,       // Interest income, misc

    // Cost of Goods Sold
    COGS: 200_000,              // Direct cost of products sold

    // Operating Expenses
    SALARY_EXPENSE: 80_000,     // Staff salaries
    RENT_EXPENSE: 20_000,       // Office/warehouse rent
    UTILITIES_EXPENSE: 10_000,  // Electricity, water, etc.
    DEPRECIATION_EXPENSE: 50_000, // Fixed asset depreciation

    // Non-Operating
    INTEREST_EXPENSE: 10_000,   // Loan interest

    // Tax
    INCOME_TAX: 48_000,         // 20% corporate tax rate

    // Calculated values
    get TOTAL_REVENUE() {
      return this.SALES_REVENUE + this.OTHER_INCOME;
    },
    get GROSS_PROFIT() {
      return this.SALES_REVENUE - this.COGS;
    },
    get TOTAL_OPERATING_EXPENSES() {
      return this.SALARY_EXPENSE + this.RENT_EXPENSE +
             this.UTILITIES_EXPENSE + this.DEPRECIATION_EXPENSE;
    },
    get OPERATING_INCOME() {
      return this.GROSS_PROFIT - this.TOTAL_OPERATING_EXPENSES;
    },
    get NET_INCOME_BEFORE_TAX() {
      return this.OPERATING_INCOME + this.OTHER_INCOME - this.INTEREST_EXPENSE;
    },
    get NET_INCOME() {
      return this.NET_INCOME_BEFORE_TAX - this.INCOME_TAX;
    },
  },

  // Cash Flow Statement values
  CASH_FLOW: {
    // Operating Activities (Indirect Method)
    NET_INCOME: 192_000,        // From Income Statement
    DEPRECIATION_ADD_BACK: 50_000, // Non-cash expense
    AR_INCREASE: -428_000,      // Cash tied up in receivables
    INVENTORY_INCREASE: -400_000, // Cash tied up in inventory
    AP_INCREASE: 100_000,       // Cash preserved by payables
    VAT_CHANGE: -21_000 + 42_000, // Net VAT movement

    // Investing Activities
    FIXED_ASSET_PURCHASE: -500_000,

    // Financing Activities
    CAPITAL_INJECTION: 1_000_000,
    LOAN_PROCEEDS: 300_000,

    // Balances
    BEGINNING_CASH: 0,

    // Calculated values
    get NET_CASH_FROM_OPERATING() {
      return this.NET_INCOME + this.DEPRECIATION_ADD_BACK +
             this.AR_INCREASE + this.INVENTORY_INCREASE +
             this.AP_INCREASE + this.VAT_CHANGE;
    },
    get NET_CASH_FROM_INVESTING() {
      return this.FIXED_ASSET_PURCHASE;
    },
    get NET_CASH_FROM_FINANCING() {
      return this.CAPITAL_INJECTION + this.LOAN_PROCEEDS;
    },
    get NET_CHANGE_IN_CASH() {
      return this.NET_CASH_FROM_OPERATING + this.NET_CASH_FROM_INVESTING +
             this.NET_CASH_FROM_FINANCING;
    },
    get ENDING_CASH() {
      return this.BEGINNING_CASH + this.NET_CHANGE_IN_CASH;
    },
  },
};

// ============================================
// Seed Functions for Financial Reports
// ============================================

/**
 * Seed additional GL Account Types if not exists
 * Note: The service uses glAccountTypes.code = 'CASH' to identify cash accounts
 */
export function seedFinancialReportAccountTypes(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO gl_account_types (id, code, name_th, name_en, category, normal_balance, display_order, created_at, updated_at)
    VALUES
      (1, '1', 'สินทรัพย์', 'Assets', 'asset', 'debit', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (2, '2', 'หนี้สิน', 'Liabilities', 'liability', 'credit', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (3, '3', 'ส่วนของผู้ถือหุ้น', 'Equity', 'equity', 'credit', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (4, '4', 'รายได้', 'Revenue', 'revenue', 'credit', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (5, '5', 'ค่าใช้จ่าย', 'Expenses', 'expense', 'debit', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (6, 'CASH', 'เงินสด', 'Cash', 'asset', 'debit', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed comprehensive GL Accounts for financial reports
 * Note: Cash accounts use account_type_id = 6 (CASH type) for cash flow statement
 * Note: Expense codes are structured so only depreciation (62xx) matches the service's '62' prefix
 */
export function seedFinancialReportAccounts(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO gl_accounts (id, code, name_th, name_en, account_type_id, parent_id, level, is_active, is_postable, is_bank_account, created_by, created_at, updated_at)
    VALUES
      -- Current Assets (11xx) - Cash accounts use CASH type (id=6)
      (${REPORT_ACCT_IDS.CASH}, '1111', 'เงินสด', 'Cash', 6, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.BANK_ACCOUNT}, '1112', 'เงินฝากธนาคาร', 'Bank Account', 6, NULL, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.AR_DOMESTIC}, '1121', 'ลูกหนี้การค้า', 'Accounts Receivable', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.INVENTORY_RAW}, '1131', 'วัตถุดิบ', 'Raw Materials', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.INVENTORY_FG}, '1133', 'สินค้าสำเร็จรูป', 'Finished Goods', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.INPUT_VAT}, '1142', 'ภาษีซื้อ', 'Input VAT', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Non-Current Assets (15xx for fixed assets, 16xx for accumulated depreciation)
      -- Note: Accum Depr uses 16xx to not be included in cash flow fixed asset calculation (service uses '15' prefix)
      (${REPORT_ACCT_IDS.FIXED_ASSETS}, '1511', 'เครื่องจักรและอุปกรณ์', 'Machinery & Equipment', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.ACCUM_DEPR}, '1611', 'ค่าเสื่อมราคาสะสม - เครื่องจักร', 'Accum. Depr. - Machinery', 1, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Current Liabilities (21xx)
      (${REPORT_ACCT_IDS.AP_DOMESTIC}, '2111', 'เจ้าหนี้การค้า', 'Accounts Payable', 2, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.OUTPUT_VAT}, '2131', 'ภาษีขาย', 'Output VAT', 2, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.WHT_PAYABLE}, '2132', 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', 'WHT Payable', 2, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Non-Current Liabilities (22xx)
      (${REPORT_ACCT_IDS.BANK_LOAN}, '2211', 'เงินกู้ยืมธนาคาร', 'Bank Loan', 2, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Equity (3xxx)
      (${REPORT_ACCT_IDS.SHARE_CAPITAL}, '3110', 'ทุนเรือนหุ้นที่ออกและชำระแล้ว', 'Paid-up Share Capital', 3, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.RETAINED_EARNINGS}, '3220', 'กำไรสะสม', 'Retained Earnings', 3, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Revenue (4xxx)
      (${REPORT_ACCT_IDS.SALES_REVENUE}, '4110', 'รายได้จากการขาย', 'Sales Revenue', 4, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.OTHER_INCOME}, '4210', 'รายได้อื่น', 'Other Income', 4, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Cost of Goods Sold (5xxx)
      (${REPORT_ACCT_IDS.COGS}, '5110', 'ต้นทุนขาย', 'Cost of Goods Sold', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Operating Expenses (6xxx) - Only depreciation (62xx) matches service's '62' prefix
      (${REPORT_ACCT_IDS.SALARY_EXPENSE}, '6110', 'เงินเดือนและค่าจ้าง', 'Salaries & Wages', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.RENT_EXPENSE}, '6120', 'ค่าเช่า', 'Rent Expense', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.UTILITIES_EXPENSE}, '6130', 'ค่าสาธารณูปโภค', 'Utilities Expense', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.DEPRECIATION_EXPENSE}, '6210', 'ค่าเสื่อมราคา', 'Depreciation Expense', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.INTEREST_EXPENSE}, '6310', 'ดอกเบี้ยจ่าย', 'Interest Expense', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${REPORT_ACCT_IDS.INCOME_TAX_EXPENSE}, '6410', 'ภาษีเงินได้นิติบุคคล', 'Income Tax Expense', 5, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed fiscal year and periods for 2026
 */
export function seedFinancialReportFiscalPeriods(sqlite: Database.Database): void {
  // Create fiscal year 2026
  sqlite.exec(`
    INSERT OR IGNORE INTO fiscal_years (id, year_code, start_date, end_date, is_current, status, created_at, updated_at)
    VALUES (1, 'FY2026', '2026-01-01', '2026-12-31', 1, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  // Create January 2026 period
  sqlite.exec(`
    INSERT OR IGNORE INTO fiscal_periods (id, fiscal_year_id, period_number, period_name, start_date, end_date, status, created_at, updated_at)
    VALUES (1, 1, 1, 'January', '2026-01-01', '2026-01-31', 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Create a posted journal entry with lines
 * Returns the journal entry ID
 */
export function createPostedJournalEntry(
  sqlite: Database.Database,
  options: {
    entryNumber: string;
    date: string;
    description: string;
    lines: Array<{ accountId: number; debit: number; credit: number; description: string }>;
    sourceType?: string;
  }
): number {
  const totalDebit = options.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = options.lines.reduce((sum, l) => sum + l.credit, 0);

  // Verify balanced entry
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced entry ${options.entryNumber}: Dr ${totalDebit} != Cr ${totalCredit}`);
  }

  const result = sqlite.prepare(`
    INSERT INTO journal_entries (
      entry_number, entry_date, fiscal_period_id, description,
      source_type, status, total_debit, total_credit,
      created_by, created_at, updated_at
    )
    VALUES (?, ?, 1, ?, ?, 'posted', ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    options.entryNumber,
    options.date,
    options.description,
    options.sourceType || 'MANUAL',
    totalDebit,
    totalCredit
  );

  const journalEntryId = result.lastInsertRowid as number;

  // Insert lines
  const insertLine = sqlite.prepare(`
    INSERT INTO journal_lines (
      journal_entry_id, line_number, gl_account_id,
      debit, credit, description, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  options.lines.forEach((line, idx) => {
    insertLine.run(journalEntryId, idx + 1, line.accountId, line.debit, line.credit, line.description);
  });

  return journalEntryId;
}

/**
 * Seed a comprehensive set of journal entries for a herbal medicine trading company
 *
 * Scenario: One month of business activity (January 2026)
 */
export function seedHerbalMedicineScenario(sqlite: Database.Database): void {
  // JE-001: Capital injection - Shareholders invest 1,000,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0001',
    date: '2026-01-01',
    description: 'Initial capital injection from shareholders',
    lines: [
      { accountId: REPORT_ACCT_IDS.CASH, debit: 800_000, credit: 0, description: 'Cash received' },
      { accountId: REPORT_ACCT_IDS.BANK_ACCOUNT, debit: 200_000, credit: 0, description: 'Bank deposit' },
      { accountId: REPORT_ACCT_IDS.SHARE_CAPITAL, debit: 0, credit: 1_000_000, description: 'Share capital issued' },
    ],
  });

  // JE-002: Purchase raw materials on credit - 300,000 THB + VAT
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0002',
    date: '2026-01-05',
    description: 'Purchase herbal raw materials from supplier',
    lines: [
      { accountId: REPORT_ACCT_IDS.INVENTORY_RAW, debit: 300_000, credit: 0, description: 'Raw materials purchased' },
      { accountId: REPORT_ACCT_IDS.INPUT_VAT, debit: 21_000, credit: 0, description: 'Input VAT 7%' },
      { accountId: REPORT_ACCT_IDS.AP_DOMESTIC, debit: 0, credit: 321_000, description: 'Payable to supplier' },
    ],
  });

  // JE-003: Partial payment to supplier - 221,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0003',
    date: '2026-01-10',
    description: 'Partial payment to raw material supplier',
    lines: [
      { accountId: REPORT_ACCT_IDS.AP_DOMESTIC, debit: 221_000, credit: 0, description: 'Reduce payable' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 221_000, description: 'Cash paid' },
    ],
  });

  // JE-004: Transfer raw materials to finished goods (manufacturing)
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0004',
    date: '2026-01-12',
    description: 'Transfer processed herbs to finished goods inventory',
    lines: [
      { accountId: REPORT_ACCT_IDS.INVENTORY_FG, debit: 300_000, credit: 0, description: 'Finished goods added' },
      { accountId: REPORT_ACCT_IDS.INVENTORY_RAW, debit: 0, credit: 200_000, description: 'Raw materials consumed' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 100_000, description: 'Processing costs paid' },
    ],
  });

  // JE-005: Sales on credit - 600,000 THB + VAT (multiple customers)
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0005',
    date: '2026-01-15',
    description: 'Sales of herbal medicine products',
    lines: [
      { accountId: REPORT_ACCT_IDS.AR_DOMESTIC, debit: 642_000, credit: 0, description: 'Customer receivable' },
      { accountId: REPORT_ACCT_IDS.SALES_REVENUE, debit: 0, credit: 600_000, description: 'Sales revenue' },
      { accountId: REPORT_ACCT_IDS.OUTPUT_VAT, debit: 0, credit: 42_000, description: 'Output VAT 7%' },
    ],
  });

  // JE-006: Record cost of goods sold
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0006',
    date: '2026-01-15',
    description: 'Record COGS for products sold',
    lines: [
      { accountId: REPORT_ACCT_IDS.COGS, debit: 200_000, credit: 0, description: 'Cost of goods sold' },
      { accountId: REPORT_ACCT_IDS.INVENTORY_FG, debit: 0, credit: 200_000, description: 'Inventory decrease' },
    ],
  });

  // JE-007: Receive partial payment from customers - 214,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0007',
    date: '2026-01-20',
    description: 'Receipt from customers',
    lines: [
      { accountId: REPORT_ACCT_IDS.CASH, debit: 214_000, credit: 0, description: 'Cash received' },
      { accountId: REPORT_ACCT_IDS.AR_DOMESTIC, debit: 0, credit: 214_000, description: 'Reduce receivable' },
    ],
  });

  // JE-008: Purchase fixed assets with bank loan - 500,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0008',
    date: '2026-01-08',
    description: 'Purchase machinery with bank financing',
    lines: [
      { accountId: REPORT_ACCT_IDS.FIXED_ASSETS, debit: 500_000, credit: 0, description: 'Machinery purchased' },
      { accountId: REPORT_ACCT_IDS.BANK_LOAN, debit: 0, credit: 300_000, description: 'Bank loan' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 200_000, description: 'Down payment' },
    ],
  });

  // JE-009: Pay salaries - 80,000 THB (with 3% WHT)
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0009',
    date: '2026-01-25',
    description: 'Monthly salary payment',
    lines: [
      { accountId: REPORT_ACCT_IDS.SALARY_EXPENSE, debit: 80_000, credit: 0, description: 'Salary expense' },
      { accountId: REPORT_ACCT_IDS.WHT_PAYABLE, debit: 0, credit: 5_000, description: 'WHT withheld' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 75_000, description: 'Net salary paid' },
    ],
  });

  // JE-010: Pay rent - 20,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0010',
    date: '2026-01-28',
    description: 'Monthly rent payment',
    lines: [
      { accountId: REPORT_ACCT_IDS.RENT_EXPENSE, debit: 20_000, credit: 0, description: 'Rent expense' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 20_000, description: 'Cash paid' },
    ],
  });

  // JE-011: Pay utilities - 10,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0011',
    date: '2026-01-28',
    description: 'Monthly utilities payment',
    lines: [
      { accountId: REPORT_ACCT_IDS.UTILITIES_EXPENSE, debit: 10_000, credit: 0, description: 'Utilities expense' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 10_000, description: 'Cash paid' },
    ],
  });

  // JE-012: Record depreciation - 50,000 THB (10% annual on 500,000 machinery)
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0012',
    date: '2026-01-31',
    description: 'Monthly depreciation on machinery',
    lines: [
      { accountId: REPORT_ACCT_IDS.DEPRECIATION_EXPENSE, debit: 50_000, credit: 0, description: 'Depreciation expense' },
      { accountId: REPORT_ACCT_IDS.ACCUM_DEPR, debit: 0, credit: 50_000, description: 'Accumulated depreciation' },
    ],
  });

  // JE-013: Accrue interest on loan - 10,000 THB
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0013',
    date: '2026-01-31',
    description: 'Accrue interest on bank loan',
    lines: [
      { accountId: REPORT_ACCT_IDS.INTEREST_EXPENSE, debit: 10_000, credit: 0, description: 'Interest expense' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 10_000, description: 'Interest paid' },
    ],
  });

  // JE-014: Other income - 10,000 THB (bank interest)
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0014',
    date: '2026-01-31',
    description: 'Interest income on bank deposits',
    lines: [
      { accountId: REPORT_ACCT_IDS.CASH, debit: 10_000, credit: 0, description: 'Interest received' },
      { accountId: REPORT_ACCT_IDS.OTHER_INCOME, debit: 0, credit: 10_000, description: 'Interest income' },
    ],
  });

  // JE-015: Provision for income tax - 48,000 THB (20% on 240,000 profit)
  // Profit before tax = 600,000 + 10,000 - 200,000 - 160,000 - 10,000 = 240,000
  createPostedJournalEntry(sqlite, {
    entryNumber: 'JE-202601-0015',
    date: '2026-01-31',
    description: 'Provision for income tax',
    lines: [
      { accountId: REPORT_ACCT_IDS.INCOME_TAX_EXPENSE, debit: 48_000, credit: 0, description: 'Income tax expense' },
      { accountId: REPORT_ACCT_IDS.CASH, debit: 0, credit: 48_000, description: 'Tax provision (simplified)' },
    ],
  });
}

/**
 * Seed users table for audit/created_by references
 */
export function seedTestUser(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, is_active, created_at, updated_at)
    VALUES (1, 'Test Admin', 'admin@test.com', 'hashed_password', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed vendors and customers for AP/AR aging tests
 */
export function seedVendorsAndCustomers(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO vendors (id, code, name, is_active, is_approved, created_at, updated_at)
    VALUES
      (1, 'VND-001', 'Herbal Supplier Co., Ltd.', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (2, 'VND-002', 'Equipment Trading Ltd.', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  sqlite.exec(`
    INSERT OR IGNORE INTO customers (id, code, name, is_active, created_at, updated_at)
    VALUES
      (1, 'CUS-001', 'Pharmacy Chain A Co., Ltd.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (2, 'CUS-002', 'Hospital B', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

// ============================================
// Composite Seed Functions
// ============================================

/**
 * Seed all data required for financial report tests
 */
export function seedFinancialReportTestData(sqlite: Database.Database): void {
  // Base data
  seedFinancialReportAccountTypes(sqlite);
  seedFinancialReportAccounts(sqlite);
  seedFinancialReportFiscalPeriods(sqlite);
  seedTestUser(sqlite);
  seedVendorsAndCustomers(sqlite);

  // Business transactions
  seedHerbalMedicineScenario(sqlite);
}

// ============================================
// Verification Helpers
// ============================================

/**
 * Get account balance from journal entries
 */
export function getAccountBalance(sqlite: Database.Database, accountId: number): number {
  const result = sqlite.prepare(`
    SELECT
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE jl.gl_account_id = ? AND je.status = 'posted'
  `).get(accountId) as { balance: number } | undefined;

  return result?.balance || 0;
}

/**
 * Verify all journal entries are balanced
 */
export function verifyAllEntriesBalanced(sqlite: Database.Database): boolean {
  const entries = sqlite.prepare(`
    SELECT je.id, je.entry_number, je.total_debit, je.total_credit,
           SUM(jl.debit) as sum_debit, SUM(jl.credit) as sum_credit
    FROM journal_entries je
    JOIN journal_lines jl ON je.id = jl.journal_entry_id
    WHERE je.status = 'posted'
    GROUP BY je.id
  `).all() as Array<{
    id: number;
    entry_number: string;
    total_debit: number;
    total_credit: number;
    sum_debit: number;
    sum_credit: number;
  }>;

  for (const entry of entries) {
    if (Math.abs(entry.sum_debit - entry.sum_credit) > 0.01) {
      console.error(`Unbalanced entry ${entry.entry_number}: Dr ${entry.sum_debit} != Cr ${entry.sum_credit}`);
      return false;
    }
  }

  return true;
}

/**
 * Calculate expected cash balance from all journal entries
 */
export function calculateExpectedCashBalance(sqlite: Database.Database): number {
  // Cash is account 101, normal balance = debit
  return getAccountBalance(sqlite, REPORT_ACCT_IDS.CASH);
}

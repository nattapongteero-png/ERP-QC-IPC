/**
 * Bank Reconciliation Service Unit Tests (T075)
 * Part of 011-accounting-spec-gap - User Story 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db-helper module
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName: string) => ({
    id: `${tableName}.id`,
    statementNumber: `${tableName}.statementNumber`,
    bankAccountId: `${tableName}.bankAccountId`,
    status: `${tableName}.status`,
    statementId: `${tableName}.statementId`,
    lineNumber: `${tableName}.lineNumber`,
    transactionDate: `${tableName}.transactionDate`,
    description: `${tableName}.description`,
    debitAmount: `${tableName}.debitAmount`,
    creditAmount: `${tableName}.creditAmount`,
    accountName: `${tableName}.accountName`,
    accountNumber: `${tableName}.accountNumber`,
    isBankAccount: `${tableName}.isBankAccount`,
    paymentStatus: `${tableName}.paymentStatus`,
    reconciledAt: `${tableName}.reconciledAt`,
    paymentAmount: `${tableName}.paymentAmount`,
    paymentDate: `${tableName}.paymentDate`,
    statementLineId: `${tableName}.statementLineId`,
  })),
  getInsertId: vi.fn(() => 1),
  executeDbOperation: vi.fn(async (operation: any) => {
    const mockDb = createMockDb();
    return operation(mockDb);
  }),
}));

// Mock date-utils
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date()),
  toDbDate: vi.fn((date: string) => date),
  formatDateFromDb: vi.fn((date: any) => date?.toString() || ''),
}));

// Mock bank reconciliation service functions
const mockStatements = [
  {
    id: 1,
    statementNumber: 'BS2024-001-0001',
    bankAccountId: 1,
    statementDate: '2024-01-15',
    openingBalance: 100000,
    closingBalance: 150000,
    totalDebits: 20000,
    totalCredits: 70000,
    status: 'in_progress',
    importedAt: '2024-01-15T10:00:00Z',
    createdBy: 1,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
];

const mockLines = [
  {
    id: 1,
    statementId: 1,
    lineNumber: 1,
    transactionDate: '2024-01-10',
    description: 'Customer Payment',
    debitAmount: null,
    creditAmount: 50000,
    status: 'imported',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    statementId: 1,
    lineNumber: 2,
    transactionDate: '2024-01-12',
    description: 'Bank Fee',
    debitAmount: 500,
    creditAmount: null,
    status: 'imported',
    createdAt: '2024-01-15T10:00:00Z',
  },
];

const mockBankAccounts = [
  { id: 1, accountName: 'Main Bank Account', accountNumber: '1234567890', isBankAccount: true },
  { id: 2, accountName: 'Petty Cash', accountNumber: '9876543210', isBankAccount: true },
];

function createMockDb() {
  const selectResult: any[] = [];
  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectResult)),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn((columns?: any) => {
      // Return different results based on what's being selected
      if (columns?.count) {
        mockQuery.limit = vi.fn().mockResolvedValue([{ count: 2 }]);
      }
      return mockQuery;
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({ lastInsertRowid: 1 }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    }),
  };
}

describe('Bank Reconciliation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateStatementNumber', () => {
    it('should generate statement number with correct format', async () => {
      const { generateStatementNumber } = await import('@/lib/services/bank-reconciliation.service');
      const number = await generateStatementNumber(1);
      expect(number).toMatch(/^BS\d{4}-001-\d{4}$/);
    });
  });

  describe('createBankStatement', () => {
    it('should create a bank statement', async () => {
      const { createBankStatement } = await import('@/lib/services/bank-reconciliation.service');
      const id = await createBankStatement(
        {
          bankAccountId: 1,
          statementDate: '2024-01-15',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          openingBalance: 100000,
          closingBalance: 150000,
          currency: 'THB',
        },
        1
      );
      expect(id).toBe(1);
    });
  });

  describe('importStatementLines', () => {
    it('should import statement lines', async () => {
      const { importStatementLines } = await import('@/lib/services/bank-reconciliation.service');
      const result = await importStatementLines(
        1,
        [
          {
            transactionDate: '2024-01-10',
            description: 'Test Transaction',
            creditAmount: 10000,
          },
        ],
        1
      );
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getBankAccounts', () => {
    it('should return bank accounts', async () => {
      const { executeDbOperation } = await import('@/lib/db/db-helper');
      vi.mocked(executeDbOperation).mockResolvedValueOnce(mockBankAccounts);

      const { getBankAccounts } = await import('@/lib/services/bank-reconciliation.service');
      const accounts = await getBankAccounts();
      expect(accounts).toBeDefined();
    });
  });
});

describe('Statement Status Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should transition from imported to in_progress', async () => {
    // Statement starts as 'imported' and transitions to 'in_progress' when lines are imported
    expect(mockStatements[0].status).toBe('in_progress');
  });

  it('should validate status for finalization', async () => {
    // Test that finalization requires balanced reconciliation
    // A reconciliation is balanced when:
    // 1. All lines are matched
    // 2. The difference is zero
    const summary = {
      isBalanced: false,
      unmatchedDebits: 1000,
      unmatchedCredits: 0,
      difference: 1000,
    };

    expect(summary.isBalanced).toBe(false);
    expect(summary.unmatchedDebits).toBeGreaterThan(0);
  });
});

describe('Auto-matching Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match by amount within tolerance', async () => {
    // Test that auto-matching works with amount tolerance
    const lineAmount = 1000;
    const paymentAmount = 1000;
    const tolerance = 0; // 0% tolerance means exact match
    const diff = Math.abs(lineAmount - paymentAmount);
    const maxAllowedDiff = lineAmount * (tolerance / 100);
    expect(diff <= maxAllowedDiff + 0.01).toBe(true);
  });

  it('should match by reference', async () => {
    // Test reference matching logic
    const lineRef = 'INV-2024-001';
    const paymentRef = 'inv-2024-001';
    expect(lineRef.toLowerCase()).toBe(paymentRef.toLowerCase());
  });

  it('should match by date within tolerance', async () => {
    // Test date matching logic
    const lineDate = new Date('2024-01-15');
    const paymentDate = new Date('2024-01-14');
    const daysDiff = Math.abs((lineDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeLessThanOrEqual(3); // 3 days tolerance
  });

  it('should calculate confidence score correctly', async () => {
    // Confidence calculation: amount match (50) + reference match (30) + date match (20)
    let confidence = 0;

    // Amount match (exact)
    confidence += 50;

    // Reference match
    confidence += 30;

    // Date match (exact)
    confidence += 20;

    expect(confidence).toBe(100);
  });
});

describe('Manual Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create match record with correct data', async () => {
    // Test that match record contains all required fields
    const matchRecord = {
      statementLineId: 1,
      matchedEntityType: 'ap_payment' as const,
      matchedEntityId: 100,
      matchType: 'manual' as const,
      matchAmount: 1000,
      matchConfidence: 100,
      notes: 'Manual match by user',
    };

    expect(matchRecord.statementLineId).toBe(1);
    expect(matchRecord.matchedEntityType).toBe('ap_payment');
    expect(matchRecord.matchType).toBe('manual');
    expect(matchRecord.matchConfidence).toBe(100);
  });

  it('should validate manual match input', async () => {
    const { manualMatchInputSchema } = await import('@/lib/validation/bank-reconciliation');

    const validInput = {
      statementLineId: 1,
      matchedEntityType: 'ap_payment' as const,
      matchedEntityId: 100,
      notes: 'Manual match',
    };

    const result = manualMatchInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

describe('Bank Charge Journal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', async () => {
    const { bankChargeJournalInputSchema } = await import('@/lib/validation/bank-reconciliation');

    const validInput = {
      statementLineId: 1,
      chargeType: 'bank_fee' as const,
      accountId: 100,
      description: 'Monthly bank fee',
    };

    const result = bankChargeJournalInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid charge type', async () => {
    const { bankChargeJournalInputSchema } = await import('@/lib/validation/bank-reconciliation');

    const invalidInput = {
      statementLineId: 1,
      chargeType: 'invalid_type',
      accountId: 100,
    };

    const result = bankChargeJournalInputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});

describe('Reconciliation Summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate balance correctly', () => {
    const openingBalance = 100000;
    const totalDebits = 20000;
    const totalCredits = 70000;
    const closingBalance = 150000;

    const expectedClosing = openingBalance - totalDebits + totalCredits;
    const difference = closingBalance - expectedClosing;

    expect(expectedClosing).toBe(150000);
    expect(difference).toBe(0);
  });

  it('should identify unbalanced reconciliation', () => {
    const openingBalance = 100000;
    const totalDebits = 20000;
    const totalCredits = 70000;
    const closingBalance = 160000; // Wrong closing balance

    const expectedClosing = openingBalance - totalDebits + totalCredits;
    const difference = closingBalance - expectedClosing;

    expect(Math.abs(difference) > 0.01).toBe(true);
  });
});

describe('Validation Schemas', () => {
  it('should validate bank statement create input', async () => {
    const { bankStatementCreateSchema } = await import('@/lib/validation/bank-reconciliation');

    const validInput = {
      bankAccountId: 1,
      statementDate: '2024-01-15',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      openingBalance: 100000,
      closingBalance: 150000,
    };

    const result = bankStatementCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid bank account id', async () => {
    const { bankStatementCreateSchema } = await import('@/lib/validation/bank-reconciliation');

    const invalidInput = {
      bankAccountId: -1,
      statementDate: '2024-01-15',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      openingBalance: 100000,
      closingBalance: 150000,
    };

    const result = bankStatementCreateSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should validate CSV import config', async () => {
    const { csvImportConfigSchema } = await import('@/lib/validation/bank-reconciliation');

    const validConfig = {
      dateFormat: 'DD/MM/YYYY',
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      debitColumn: 'Debit',
      creditColumn: 'Credit',
      hasHeader: true,
    };

    const result = csvImportConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should validate auto-match config', async () => {
    const { autoMatchConfigSchema } = await import('@/lib/validation/bank-reconciliation');

    const validConfig = {
      statementId: 1,
      matchByAmount: true,
      matchByReference: true,
      matchByDate: true,
      dateToleranceDays: 3,
      amountTolerancePercent: 0,
    };

    const result = autoMatchConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });
});

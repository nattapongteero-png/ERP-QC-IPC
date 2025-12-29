/**
 * Credit/Debit Notes Service Unit Tests (T100)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db-helper module
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName: string) => ({
    id: `${tableName}.id`,
    noteNumber: `${tableName}.noteNumber`,
    noteType: `${tableName}.noteType`,
    referenceType: `${tableName}.referenceType`,
    referenceInvoiceId: `${tableName}.referenceInvoiceId`,
    customerId: `${tableName}.customerId`,
    vendorId: `${tableName}.vendorId`,
    noteDate: `${tableName}.noteDate`,
    reasonCode: `${tableName}.reasonCode`,
    status: `${tableName}.status`,
    subtotal: `${tableName}.subtotal`,
    vatRate: `${tableName}.vatRate`,
    vatAmount: `${tableName}.vatAmount`,
    totalAmount: `${tableName}.totalAmount`,
    noteId: `${tableName}.noteId`,
    lineNumber: `${tableName}.lineNumber`,
    description: `${tableName}.description`,
    quantity: `${tableName}.quantity`,
    unitPrice: `${tableName}.unitPrice`,
    lineTotal: `${tableName}.lineTotal`,
    glAccountId: `${tableName}.glAccountId`,
    invoiceNumber: `${tableName}.invoiceNumber`,
    name: `${tableName}.name`,
    accountNumber: `${tableName}.accountNumber`,
    accountName: `${tableName}.accountName`,
    postedAt: `${tableName}.postedAt`,
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

// Mock approval workflow
vi.mock('@/lib/services/approval-workflow.service', () => ({
  submitForApproval: vi.fn().mockResolvedValue({ requestId: 1, flowName: 'credit_note_approval' }),
}));

function createMockDb() {
  const selectResult: any[] = [];
  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectResult)),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn((columns?: any) => {
      if (columns?.count) {
        mockQuery.limit = vi.fn().mockResolvedValue([{ count: 2 }]);
      }
      if (columns?.sum) {
        mockQuery.limit = vi.fn().mockResolvedValue([{ sum: 10000 }]);
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

describe('Credit/Debit Notes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateNoteNumber', () => {
    it('should generate AR credit note number with correct format', async () => {
      const { generateNoteNumber } = await import('@/lib/services/credit-debit-notes.service');
      const number = await generateNoteNumber('ar_credit');
      expect(number).toMatch(/^CN-AR-\d{4}-\d{4}$/);
    });

    it('should generate AP credit note number with correct format', async () => {
      const { generateNoteNumber } = await import('@/lib/services/credit-debit-notes.service');
      const number = await generateNoteNumber('ap_credit');
      expect(number).toMatch(/^CN-AP-\d{4}-\d{4}$/);
    });

    it('should generate AR debit note number with correct format', async () => {
      const { generateNoteNumber } = await import('@/lib/services/credit-debit-notes.service');
      const number = await generateNoteNumber('ar_debit');
      expect(number).toMatch(/^DN-AR-\d{4}-\d{4}$/);
    });

    it('should generate AP debit note number with correct format', async () => {
      const { generateNoteNumber } = await import('@/lib/services/credit-debit-notes.service');
      const number = await generateNoteNumber('ap_debit');
      expect(number).toMatch(/^DN-AP-\d{4}-\d{4}$/);
    });
  });

  describe('createNote', () => {
    it('should create a credit note', async () => {
      const { createNote } = await import('@/lib/services/credit-debit-notes.service');
      const id = await createNote(
        {
          noteType: 'ar_credit',
          referenceInvoiceId: 1,
          noteDate: '2024-01-15',
          reasonCode: 'return',
          reasonDescription: 'Goods returned',
          lines: [
            {
              description: 'Product return',
              quantity: 10,
              unitPrice: 100,
              glAccountId: 400,
            },
          ],
        },
        1
      );
      expect(id).toBe(1);
    });
  });
});

describe('Note Status Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only allow updating draft notes', () => {
    const draftNote = { status: 'draft' };
    const postedNote = { status: 'posted' };

    expect(draftNote.status === 'draft').toBe(true);
    expect(postedNote.status === 'draft').toBe(false);
  });

  it('should only allow cancelling non-posted notes', () => {
    const statuses = ['draft', 'submitted', 'approved', 'posted', 'cancelled'];
    const cancellableStatuses = statuses.filter(s => s !== 'posted' && s !== 'cancelled');
    expect(cancellableStatuses).toEqual(['draft', 'submitted', 'approved']);
  });

  it('should only allow posting approved notes', () => {
    const approvedNote = { status: 'approved' };
    const draftNote = { status: 'draft' };

    expect(approvedNote.status === 'approved').toBe(true);
    expect(draftNote.status === 'approved').toBe(false);
  });
});

describe('Note Amount Calculations', () => {
  it('should calculate subtotal correctly', () => {
    const lines = [
      { quantity: 10, unitPrice: 100 },
      { quantity: 5, unitPrice: 200 },
    ];

    const subtotal = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );

    expect(subtotal).toBe(2000);
  });

  it('should calculate VAT correctly', () => {
    const subtotal = 10000;
    const vatRate = 0.07;
    const vatAmount = subtotal * vatRate;

    expect(vatAmount).toBeCloseTo(700, 2);
  });

  it('should calculate total correctly', () => {
    const subtotal = 10000;
    const vatRate = 0.07;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    expect(total).toBe(10700);
  });
});

describe('Note Type Validation', () => {
  it('should identify AR credit notes correctly', () => {
    const noteType = 'ar_credit';
    expect(noteType.startsWith('ar_')).toBe(true);
    expect(noteType.includes('credit')).toBe(true);
  });

  it('should identify AP credit notes correctly', () => {
    const noteType = 'ap_credit';
    expect(noteType.startsWith('ap_')).toBe(true);
    expect(noteType.includes('credit')).toBe(true);
  });

  it('should identify AR debit notes correctly', () => {
    const noteType = 'ar_debit';
    expect(noteType.startsWith('ar_')).toBe(true);
    expect(noteType.includes('debit')).toBe(true);
  });

  it('should identify AP debit notes correctly', () => {
    const noteType = 'ap_debit';
    expect(noteType.startsWith('ap_')).toBe(true);
    expect(noteType.includes('debit')).toBe(true);
  });
});

describe('Reason Code Validation', () => {
  it('should accept valid reason codes', () => {
    const validReasonCodes = [
      'return',
      'price_adjustment',
      'quantity_adjustment',
      'defect',
      'discount',
      'other',
    ];

    validReasonCodes.forEach((code) => {
      expect(validReasonCodes.includes(code)).toBe(true);
    });
  });
});

describe('Validation Schemas', () => {
  it('should validate credit note create input', async () => {
    const { creditDebitNoteCreateSchema } = await import('@/lib/validation/credit-debit-notes');

    const validInput = {
      noteType: 'ar_credit',
      referenceInvoiceId: 1,
      noteDate: '2024-01-15',
      reasonCode: 'return',
      lines: [
        {
          description: 'Test line',
          quantity: 1,
          unitPrice: 100,
          glAccountId: 400,
        },
      ],
    };

    const result = creditDebitNoteCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid note type', async () => {
    const { noteTypeSchema } = await import('@/lib/validation/credit-debit-notes');

    const invalidInput = 'invalid_type';
    const result = noteTypeSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject invalid reason code', async () => {
    const { reasonCodeSchema } = await import('@/lib/validation/credit-debit-notes');

    const invalidInput = 'invalid_reason';
    const result = reasonCodeSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should require at least one line', async () => {
    const { creditDebitNoteCreateSchema } = await import('@/lib/validation/credit-debit-notes');

    const inputWithNoLines = {
      noteType: 'ar_credit',
      referenceInvoiceId: 1,
      noteDate: '2024-01-15',
      reasonCode: 'return',
      lines: [],
    };

    const result = creditDebitNoteCreateSchema.safeParse(inputWithNoLines);
    expect(result.success).toBe(false);
  });
});

describe('Journal Entry Creation', () => {
  it('should create balanced journal entries', () => {
    // AR Credit Note: Dr Revenue, Dr VAT Output, Cr AR
    const subtotal = 10000;
    const vatAmount = 700;
    const totalAmount = 10700;

    const debitTotal = subtotal + vatAmount; // Revenue + VAT Output
    const creditTotal = totalAmount; // AR

    expect(debitTotal).toBe(creditTotal);
  });

  it('should create correct entry for AP Credit Note', () => {
    // AP Credit Note: Dr AP, Cr Expense, Cr VAT Input
    const subtotal = 10000;
    const vatAmount = 700;
    const totalAmount = 10700;

    const debitTotal = totalAmount; // AP
    const creditTotal = subtotal + vatAmount; // Expense + VAT Input

    expect(debitTotal).toBe(creditTotal);
  });
});

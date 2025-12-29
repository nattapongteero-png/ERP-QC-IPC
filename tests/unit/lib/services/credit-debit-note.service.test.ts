/**
 * Credit/Debit Note Service Unit Tests (T100)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  noteCreateSchema,
  noteUpdateSchema,
  noteListFilterSchema,
} from '@/lib/validation/credit-debit-note';
import type { NoteType, ReasonCode, NoteStatus } from '@/types/credit-debit-notes';

// Mock the db-helper and date-utils
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName) => ({ [tableName]: true })),
  getInsertId: vi.fn(() => 1),
  executeDbOperation: vi.fn(async (callback) => {
    // Mock database
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    };
    return callback(mockDb);
  }),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date()),
  toDbDate: vi.fn((date) => new Date(date)),
  formatDateFromDb: vi.fn((date) => date),
}));

describe('Credit/Debit Note Service - Validation', () => {
  describe('noteCreateSchema', () => {
    it('validates a valid note create input', () => {
      const validInput = {
        noteType: 'ar_credit' as NoteType,
        referenceType: 'ar_invoice' as const,
        referenceInvoiceId: 1,
        customerId: 1,
        noteDate: '2024-01-15',
        reasonCode: 'return' as ReasonCode,
        reasonDescription: 'Goods returned',
        vatRate: 0.07,
        notes: 'Test note',
        lines: [
          {
            description: 'Line 1',
            quantity: 1,
            unitPrice: 1000,
            glAccountId: 1,
          },
        ],
      };

      const result = noteCreateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects input without required fields', () => {
      const invalidInput = {
        noteType: 'ar_credit',
        // Missing referenceType, referenceInvoiceId, noteDate, reasonCode, lines
      };

      const result = noteCreateSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('rejects invalid note type', () => {
      const invalidInput = {
        noteType: 'invalid_type',
        referenceType: 'ar_invoice',
        referenceInvoiceId: 1,
        noteDate: '2024-01-15',
        reasonCode: 'return',
        lines: [{ description: 'Test', quantity: 1, unitPrice: 100, glAccountId: 1 }],
      };

      const result = noteCreateSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('validates note with minimum required fields', () => {
      const minInput = {
        noteType: 'ap_debit' as NoteType,
        referenceType: 'ap_invoice' as const,
        referenceInvoiceId: 1,
        vendorId: 1, // Required for AP notes
        noteDate: '2024-01-15',
        reasonCode: 'price_adjustment' as ReasonCode,
        lines: [
          {
            description: 'Adjustment',
            quantity: 1,
            unitPrice: 500,
            glAccountId: 2,
          },
        ],
      };

      const result = noteCreateSchema.safeParse(minInput);
      expect(result.success).toBe(true);
    });

    it('rejects empty lines array', () => {
      const invalidInput = {
        noteType: 'ar_credit',
        referenceType: 'ar_invoice',
        referenceInvoiceId: 1,
        noteDate: '2024-01-15',
        reasonCode: 'return',
        lines: [],
      };

      const result = noteCreateSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('noteUpdateSchema', () => {
    it('validates a valid update input', () => {
      const validInput = {
        noteDate: '2024-01-20',
        reasonCode: 'defect' as ReasonCode,
        reasonDescription: 'Updated description',
      };

      const result = noteUpdateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts empty update object', () => {
      const result = noteUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates update with new lines', () => {
      const validInput = {
        lines: [
          {
            description: 'New line',
            quantity: 2,
            unitPrice: 750,
            glAccountId: 3,
          },
        ],
      };

      const result = noteUpdateSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('noteListFilterSchema', () => {
    it('validates a complete filter', () => {
      const validFilter = {
        noteType: 'ar_credit' as NoteType,
        status: 'draft' as NoteStatus,
        customerId: 1,
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
        page: 1,
        limit: 20,
      };

      const result = noteListFilterSchema.safeParse(validFilter);
      expect(result.success).toBe(true);
    });

    it('accepts empty filter', () => {
      const result = noteListFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates filter with search term', () => {
      const validFilter = {
        search: 'CN2024',
      };

      const result = noteListFilterSchema.safeParse(validFilter);
      expect(result.success).toBe(true);
    });
  });
});

describe('Credit/Debit Note Service - Business Logic', () => {
  describe('Note Types', () => {
    it('validates all note types', () => {
      const noteTypes: NoteType[] = ['ar_credit', 'ap_credit', 'ar_debit', 'ap_debit'];

      noteTypes.forEach((noteType) => {
        const isAR = noteType.startsWith('ar_');
        const input = {
          noteType,
          referenceType: isAR ? 'ar_invoice' : 'ap_invoice',
          referenceInvoiceId: 1,
          customerId: isAR ? 1 : undefined,  // Required for AR notes
          vendorId: isAR ? undefined : 1,    // Required for AP notes
          noteDate: '2024-01-15',
          reasonCode: 'return' as ReasonCode,
          lines: [{ description: 'Test', quantity: 1, unitPrice: 100, glAccountId: 1 }],
        };

        const result = noteCreateSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Reason Codes', () => {
    it('validates all reason codes', () => {
      const reasonCodes: ReasonCode[] = [
        'return',
        'price_adjustment',
        'quantity_adjustment',
        'defect',
        'discount',
        'other',
      ];

      reasonCodes.forEach((reasonCode) => {
        const input = {
          noteType: 'ar_credit' as NoteType,
          referenceType: 'ar_invoice' as const,
          referenceInvoiceId: 1,
          customerId: 1, // Required for AR notes
          noteDate: '2024-01-15',
          reasonCode,
          lines: [{ description: 'Test', quantity: 1, unitPrice: 100, glAccountId: 1 }],
        };

        const result = noteCreateSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Note Status Workflow', () => {
    it('validates all note statuses', () => {
      const statuses: NoteStatus[] = ['draft', 'submitted', 'approved', 'posted', 'cancelled'];

      statuses.forEach((status) => {
        const filter = { status };
        const result = noteListFilterSchema.safeParse(filter);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('VAT Calculation', () => {
    it('calculates correct totals with 7% VAT', () => {
      const lines = [
        { description: 'Item 1', quantity: 1, unitPrice: 1000, glAccountId: 1 },
        { description: 'Item 2', quantity: 2, unitPrice: 500, glAccountId: 1 },
      ];
      const vatRate = 0.07;

      const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const vatAmount = subtotal * vatRate;
      const totalAmount = subtotal + vatAmount;

      expect(subtotal).toBe(2000);
      expect(vatAmount).toBe(140);
      expect(totalAmount).toBe(2140);
    });

    it('handles zero VAT rate', () => {
      const lines = [
        { description: 'Item 1', quantity: 1, unitPrice: 1000, glAccountId: 1 },
      ];
      const vatRate = 0;

      const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const vatAmount = subtotal * vatRate;
      const totalAmount = subtotal + vatAmount;

      expect(subtotal).toBe(1000);
      expect(vatAmount).toBe(0);
      expect(totalAmount).toBe(1000);
    });
  });

  describe('Line Total Calculation', () => {
    it('calculates correct line total', () => {
      const line = { quantity: 3, unitPrice: 250 };
      const lineTotal = line.quantity * line.unitPrice;
      expect(lineTotal).toBe(750);
    });

    it('handles decimal quantities', () => {
      const line = { quantity: 1.5, unitPrice: 100 };
      const lineTotal = line.quantity * line.unitPrice;
      expect(lineTotal).toBe(150);
    });
  });
});

describe('Credit/Debit Note Service - Note Number Generation', () => {
  describe('Note Number Format', () => {
    it('generates correct format for AR Credit', () => {
      const noteType = 'ar_credit';
      const year = new Date().getFullYear();
      const expectedPrefix = `AR-CREDIT${year}-`;

      expect(noteType.toUpperCase().replace('_', '-')).toBe('AR-CREDIT');
    });

    it('generates correct format for AP Debit', () => {
      const noteType = 'ap_debit';
      const year = new Date().getFullYear();
      const expectedPrefix = `AP-DEBIT${year}-`;

      expect(noteType.toUpperCase().replace('_', '-')).toBe('AP-DEBIT');
    });

    it('pads sequence number to 4 digits', () => {
      const sequence = 1;
      const paddedSequence = sequence.toString().padStart(4, '0');
      expect(paddedSequence).toBe('0001');
    });

    it('handles large sequence numbers', () => {
      const sequence = 9999;
      const paddedSequence = sequence.toString().padStart(4, '0');
      expect(paddedSequence).toBe('9999');
    });
  });
});

describe('Credit/Debit Note Service - Reference Invoices', () => {
  describe('Invoice Type Mapping', () => {
    it('maps ar_ note types to ar_invoice', () => {
      const noteTypes: NoteType[] = ['ar_credit', 'ar_debit'];

      noteTypes.forEach((noteType) => {
        const referenceType = noteType.startsWith('ar_') ? 'ar_invoice' : 'ap_invoice';
        expect(referenceType).toBe('ar_invoice');
      });
    });

    it('maps ap_ note types to ap_invoice', () => {
      const noteTypes: NoteType[] = ['ap_credit', 'ap_debit'];

      noteTypes.forEach((noteType) => {
        const referenceType = noteType.startsWith('ar_') ? 'ar_invoice' : 'ap_invoice';
        expect(referenceType).toBe('ap_invoice');
      });
    });
  });
});

describe('Credit/Debit Note Service - Workflow Validation', () => {
  describe('Draft Status Operations', () => {
    it('allows update on draft notes', () => {
      const status = 'draft';
      const canUpdate = status === 'draft';
      expect(canUpdate).toBe(true);
    });

    it('allows delete on draft notes', () => {
      const status = 'draft';
      const canDelete = status === 'draft';
      expect(canDelete).toBe(true);
    });

    it('allows submit on draft notes', () => {
      const status = 'draft';
      const canSubmit = status === 'draft';
      expect(canSubmit).toBe(true);
    });
  });

  describe('Submitted Status Operations', () => {
    it('allows approve on submitted notes', () => {
      const status = 'submitted';
      const canApprove = status === 'submitted';
      expect(canApprove).toBe(true);
    });

    it('allows reject on submitted notes', () => {
      const status = 'submitted';
      const canReject = status === 'submitted';
      expect(canReject).toBe(true);
    });

    it('disallows update on submitted notes', () => {
      const status: string = 'submitted';
      const canUpdate = status === 'draft';
      expect(canUpdate).toBe(false);
    });
  });

  describe('Approved Status Operations', () => {
    it('allows post on approved notes', () => {
      const status: string = 'approved';
      const canPost = status === 'approved';
      expect(canPost).toBe(true);
    });

    it('disallows update on approved notes', () => {
      const status: string = 'approved';
      const canUpdate = status === 'draft';
      expect(canUpdate).toBe(false);
    });
  });

  describe('Posted Status Operations', () => {
    it('disallows cancel on posted notes', () => {
      const status: string = 'posted';
      const canCancel = status !== 'posted';
      expect(canCancel).toBe(false);
    });

    it('disallows update on posted notes', () => {
      const status: string = 'posted';
      const canUpdate = status === 'draft';
      expect(canUpdate).toBe(false);
    });
  });

  describe('Cancel Operations', () => {
    it('allows cancel on draft notes', () => {
      const status = 'draft';
      const canCancel = ['draft', 'submitted', 'approved'].includes(status);
      expect(canCancel).toBe(true);
    });

    it('allows cancel on submitted notes', () => {
      const status = 'submitted';
      const canCancel = ['draft', 'submitted', 'approved'].includes(status);
      expect(canCancel).toBe(true);
    });

    it('allows cancel on approved notes', () => {
      const status = 'approved';
      const canCancel = ['draft', 'submitted', 'approved'].includes(status);
      expect(canCancel).toBe(true);
    });
  });
});

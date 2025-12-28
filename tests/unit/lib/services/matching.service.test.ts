/**
 * 3-Way Matching Service Unit Tests (T121)
 * Part of 011-accounting-spec-gap - User Story 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db-helper module
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName: string) => ({
    id: `${tableName}.id`,
    name: `${tableName}.name`,
    isDefault: `${tableName}.isDefault`,
    quantityTolerancePct: `${tableName}.quantityTolerancePct`,
    priceTolerancePct: `${tableName}.priceTolerancePct`,
    totalTolerancePct: `${tableName}.totalTolerancePct`,
    isActive: `${tableName}.isActive`,
    status: `${tableName}.status`,
    apInvoiceId: `${tableName}.apInvoiceId`,
    purchaseOrderId: `${tableName}.purchaseOrderId`,
    matchingResultId: `${tableName}.matchingResultId`,
    exceptionType: `${tableName}.exceptionType`,
    varianceAmount: `${tableName}.varianceAmount`,
    variancePct: `${tableName}.variancePct`,
    resolutionAction: `${tableName}.resolutionAction`,
    resolutionNotes: `${tableName}.resolutionNotes`,
    resolvedBy: `${tableName}.resolvedBy`,
    resolvedAt: `${tableName}.resolvedAt`,
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
  getTodayStr: vi.fn(() => '2024-01-15'),
}));

// Mock tolerances
const mockTolerances = [
  {
    id: 1,
    name: 'Default Tolerance',
    isDefault: true,
    quantityTolerancePct: 5,
    quantityToleranceAbs: 0,
    priceTolerancePct: 2,
    priceToleranceAbs: 0,
    totalTolerancePct: 5,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'High Tolerance',
    isDefault: false,
    quantityTolerancePct: 10,
    quantityToleranceAbs: 0,
    priceTolerancePct: 5,
    priceToleranceAbs: 0,
    totalTolerancePct: 10,
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
  },
];

const mockMatchingResults = [
  {
    id: 1,
    apInvoiceId: 1,
    purchaseOrderId: 1,
    matchedAt: '2024-01-15T10:00:00Z',
    matchedBy: 1,
    status: 'matched',
    toleranceId: 1,
    quantityVariance: 0,
    priceVariance: 0,
    amountVariance: 0,
    createdAt: '2024-01-15T10:00:00Z',
  },
];

const mockExceptions = [
  {
    id: 1,
    matchingResultId: 1,
    exceptionType: 'quantity_variance',
    varianceAmount: 100,
    variancePct: 5.5,
    status: 'pending',
    resolutionAction: null,
    resolutionNotes: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2024-01-15T10:00:00Z',
  },
];

function createMockDb() {
  let selectResult: any[] = [];
  let callCount = 0;

  // Create a thenable mock query that supports all chained methods
  const createMockQuery = (): any => {
    const mockQuery: any = {};

    // All chainable methods return the same mockQuery
    const chainMethods = ['from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'innerJoin', 'groupBy'];
    chainMethods.forEach(method => {
      mockQuery[method] = vi.fn().mockReturnValue(mockQuery);
    });

    // Make the query thenable (for await)
    mockQuery.then = (resolve: any, reject?: any) => Promise.resolve(selectResult).then(resolve, reject);
    mockQuery.catch = (reject: any) => Promise.resolve(selectResult).catch(reject);

    return mockQuery;
  };

  return {
    select: vi.fn((columns?: any) => {
      callCount++;
      // Return different results based on context
      if (columns?.count) {
        selectResult = [{ count: mockTolerances.length }];
      } else {
        selectResult = mockTolerances;
      }
      return createMockQuery();
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

describe('3-Way Matching Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tolerance Management', () => {
    describe('createTolerance', () => {
      it('should create a new tolerance profile', async () => {
        const { createTolerance } = await import('@/lib/services/matching.service');
        const id = await createTolerance(
          {
            name: 'Test Tolerance',
            toleranceType: 'quantity',
            toleranceMethod: 'percentage',
            toleranceValue: 5,
            isActive: true,
          },
          1  // createdBy user ID
        );
        expect(id).toBe(1);
      });

      it('should accept percentage tolerance method', async () => {
        const { createTolerance } = await import('@/lib/services/matching.service');
        const id = await createTolerance(
          {
            name: 'Percentage Tolerance',
            toleranceType: 'price',
            toleranceMethod: 'percentage',
            toleranceValue: 10,
          },
          1  // createdBy user ID
        );
        expect(id).toBe(1);
      });

      it('should accept absolute tolerance method', async () => {
        const { createTolerance } = await import('@/lib/services/matching.service');
        const id = await createTolerance(
          {
            name: 'Absolute Tolerance',
            toleranceType: 'amount',
            toleranceMethod: 'absolute',
            toleranceValue: 1000,
          },
          1  // createdBy user ID
        );
        expect(id).toBe(1);
      });
    });

    describe('listTolerances', () => {
      it('should list all tolerances', async () => {
        const { listTolerances } = await import('@/lib/services/matching.service');
        const result = await listTolerances({ page: 1, limit: 20 });
        expect(result).toBeDefined();
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('should filter tolerances by active status', async () => {
        const { listTolerances } = await import('@/lib/services/matching.service');
        const result = await listTolerances({ isActive: true, page: 1, limit: 20 });
        expect(result).toBeDefined();
      });

      it('should filter tolerances by type', async () => {
        const { listTolerances } = await import('@/lib/services/matching.service');
        const result = await listTolerances({ toleranceType: 'quantity', page: 1, limit: 20 });
        expect(result).toBeDefined();
      });
    });

    describe('updateTolerance', () => {
      it('should update an existing tolerance', async () => {
        const { updateTolerance } = await import('@/lib/services/matching.service');
        await expect(
          updateTolerance(1, { name: 'Updated Tolerance', toleranceValue: 8 })
        ).resolves.not.toThrow();
      });
    });

    describe('deleteTolerance', () => {
      it('should delete a tolerance profile', async () => {
        const { deleteTolerance } = await import('@/lib/services/matching.service');
        await expect(deleteTolerance(2)).resolves.not.toThrow();
      });
    });
  });

  describe('Matching Execution', () => {
    describe('runMatching', () => {
      it('should be a callable function', async () => {
        const { runMatching } = await import('@/lib/services/matching.service');
        expect(typeof runMatching).toBe('function');
      });

      it('should accept valid invoice ID', async () => {
        const { runMatching } = await import('@/lib/services/matching.service');
        const result = await runMatching({ invoiceId: 1 }, 1);
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      });

      it('should accept tolerance overrides', async () => {
        const { runMatching } = await import('@/lib/services/matching.service');
        const result = await runMatching(
          {
            invoiceId: 1,
            toleranceOverrides: [
              { toleranceType: 'quantity', toleranceMethod: 'percentage', toleranceValue: 10 },
            ],
          },
          1
        );
        expect(result).toBeDefined();
      });
    });

    describe('getMatchingResultByInvoice', () => {
      it('should retrieve matching results for an invoice', async () => {
        const { getMatchingResultByInvoice } = await import('@/lib/services/matching.service');
        const result = await getMatchingResultByInvoice(1);
        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.exceptions).toBeDefined();
      });
    });
  });

  describe('Exception Management', () => {
    describe('listExceptions', () => {
      it('should list all exceptions', async () => {
        const { listExceptions } = await import('@/lib/services/matching.service');
        const result = await listExceptions({ page: 1, limit: 20 });
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        expect(result.page).toBe(1);
      });

      it('should filter by status', async () => {
        const { listExceptions } = await import('@/lib/services/matching.service');
        const result = await listExceptions({ status: 'pending', page: 1, limit: 20 });
        expect(result).toBeDefined();
      });

      it('should filter by exception type', async () => {
        const { listExceptions } = await import('@/lib/services/matching.service');
        const result = await listExceptions({ exceptionType: 'quantity_variance', page: 1, limit: 20 });
        expect(result).toBeDefined();
      });

      it('should support date range filter', async () => {
        const { listExceptions } = await import('@/lib/services/matching.service');
        const result = await listExceptions({
          fromDate: '2024-01-01',
          toDate: '2024-01-31',
          page: 1,
          limit: 20,
        });
        expect(result).toBeDefined();
      });
    });

    describe('approveException', () => {
      it('should be a callable function', async () => {
        const { approveException } = await import('@/lib/services/matching.service');
        expect(typeof approveException).toBe('function');
      });

      it('should accept exception ID, user ID and comments', async () => {
        const { approveException } = await import('@/lib/services/matching.service');
        // Function exists and accepts parameters
        const result = await approveException(1, 1, 'Approved by manager');
        expect(result).toBeDefined();
      });
    });

    describe('rejectException', () => {
      it('should be a callable function', async () => {
        const { rejectException } = await import('@/lib/services/matching.service');
        expect(typeof rejectException).toBe('function');
      });

      it('should accept exception ID, user ID and comments', async () => {
        const { rejectException } = await import('@/lib/services/matching.service');
        const result = await rejectException(1, 1, 'Variance too high');
        expect(result).toBeDefined();
      });
    });
  });

  describe('Reports', () => {
    describe('getGRIRClearingReport', () => {
      it('should be a callable function', async () => {
        const { getGRIRClearingReport } = await import('@/lib/services/matching.service');
        expect(typeof getGRIRClearingReport).toBe('function');
      });

      it('should accept filter parameters', async () => {
        const { getGRIRClearingReport } = await import('@/lib/services/matching.service');
        const result = await getGRIRClearingReport({ vendorId: 1 });
        expect(result).toBeDefined();
      });

      it('should accept status filter', async () => {
        const { getGRIRClearingReport } = await import('@/lib/services/matching.service');
        const result = await getGRIRClearingReport({ status: 'open' });
        expect(result).toBeDefined();
      });
    });

    describe('getMatchingSummary', () => {
      it('should be a callable function', async () => {
        const { getMatchingSummary } = await import('@/lib/services/matching.service');
        expect(typeof getMatchingSummary).toBe('function');
      });

      it('should return summary object', async () => {
        const { getMatchingSummary } = await import('@/lib/services/matching.service');
        const result = await getMatchingSummary();
        expect(result).toBeDefined();
      });
    });
  });
});

describe('Validation Schemas', () => {
  describe('toleranceCreateSchema', () => {
    it('should validate valid tolerance input', async () => {
      const { toleranceCreateSchema } = await import('@/lib/validation/matching');
      const result = toleranceCreateSchema.safeParse({
        name: 'Test Tolerance',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', async () => {
      const { toleranceCreateSchema } = await import('@/lib/validation/matching');
      const result = toleranceCreateSchema.safeParse({
        name: '',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative tolerance value', async () => {
      const { toleranceCreateSchema } = await import('@/lib/validation/matching');
      const result = toleranceCreateSchema.safeParse({
        name: 'Test',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: -5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject percentage > 100', async () => {
      const { toleranceCreateSchema } = await import('@/lib/validation/matching');
      const result = toleranceCreateSchema.safeParse({
        name: 'Test',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('matchingRequestSchema', () => {
    it('should validate valid matching request', async () => {
      const { matchingRequestSchema } = await import('@/lib/validation/matching');
      const result = matchingRequestSchema.safeParse({
        invoiceId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid invoice ID', async () => {
      const { matchingRequestSchema } = await import('@/lib/validation/matching');
      const result = matchingRequestSchema.safeParse({
        invoiceId: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should accept tolerance overrides', async () => {
      const { matchingRequestSchema } = await import('@/lib/validation/matching');
      const result = matchingRequestSchema.safeParse({
        invoiceId: 1,
        toleranceOverrides: [
          { toleranceType: 'quantity', toleranceMethod: 'percentage', toleranceValue: 10 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('exceptionListFilterSchema', () => {
    it('should validate valid filter', async () => {
      const { exceptionListFilterSchema } = await import('@/lib/validation/matching');
      const result = exceptionListFilterSchema.safeParse({
        status: 'pending',
        page: 1,
        limit: 20,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', async () => {
      const { exceptionListFilterSchema } = await import('@/lib/validation/matching');
      const result = exceptionListFilterSchema.safeParse({
        status: 'invalid_status',
      });
      expect(result.success).toBe(false);
    });
  });
});

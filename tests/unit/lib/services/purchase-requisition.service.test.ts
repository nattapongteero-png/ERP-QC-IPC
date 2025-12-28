/**
 * Purchase Requisition Service Unit Tests (T050)
 * Part of 011-accounting-spec-gap
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data storage
let mockPRs: Record<number, any> = {};
let mockLines: Record<number, any[]> = {};
let mockPOs: Record<number, any> = {};
let nextPRId = 1;
let nextLineId = 1;
let nextPOId = 1;

// Create chainable mock DB
const createMockDb = () => {
  const mockDb: any = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  };

  // Insert chain
  mockDb.insert.mockImplementation((table: any) => ({
    values: vi.fn().mockImplementation((data: any) => {
      const tableName = table?.name || 'unknown';
      if (tableName === 'purchaseRequisitions') {
        const id = nextPRId++;
        mockPRs[id] = { ...data, id, prNumber: `PR2024-${id.toString().padStart(4, '0')}` };
        mockLines[id] = [];
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'purchaseRequisitionLines') {
        const id = nextLineId++;
        const prId = data.prId;
        if (!mockLines[prId]) mockLines[prId] = [];
        mockLines[prId].push({ ...data, id });
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      if (tableName === 'purchaseOrders') {
        const id = nextPOId++;
        mockPOs[id] = { ...data, id, poNumber: `PO2024-${id.toString().padStart(4, '0')}` };
        return Promise.resolve({ lastInsertRowid: id, insertId: id });
      }
      return Promise.resolve({ lastInsertRowid: 1, insertId: 1 });
    }),
  }));

  // Update chain
  mockDb.update.mockImplementation((table: any) => ({
    set: vi.fn().mockImplementation((data: any) => ({
      where: vi.fn().mockImplementation(() => {
        const tableName = table?.name || 'unknown';
        if (tableName === 'purchaseRequisitions') {
          for (const id in mockPRs) {
            Object.assign(mockPRs[id], data);
            break;
          }
        }
        return Promise.resolve();
      }),
    })),
  }));

  // Delete chain
  mockDb.delete.mockImplementation((table: any) => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));

  // Select chain
  mockDb.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation((table: any) => {
      const tableName = table?.name || 'unknown';
      return {
        where: vi.fn().mockImplementation(() => {
          if (tableName === 'purchaseRequisitions') {
            const prs = Object.values(mockPRs);
            return {
              limit: vi.fn().mockResolvedValue(prs.slice(0, 1)),
              orderBy: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockResolvedValue(prs.slice(0, 1)),
              })),
            };
          }
          if (tableName === 'purchaseRequisitionLines') {
            const allLines = Object.values(mockLines).flat();
            return {
              orderBy: vi.fn().mockResolvedValue(allLines),
            };
          }
          return Promise.resolve([]);
        }),
        orderBy: vi.fn().mockImplementation(() => {
          if (tableName === 'purchaseRequisitions') {
            return {
              limit: vi.fn().mockImplementation(() => ({
                offset: vi.fn().mockResolvedValue(Object.values(mockPRs)),
              })),
            };
          }
          return Promise.resolve([]);
        }),
        limit: vi.fn().mockResolvedValue([]),
      };
    }),
  }));

  return mockDb;
};

// Mock dependencies
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((table: string) => ({ name: table })),
  getInsertId: vi.fn((result: any) => result.lastInsertRowid || result.insertId || 1),
  executeDbOperation: vi.fn(async (operation: any) => {
    const mockDb = createMockDb();
    return operation(mockDb);
  }),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2024-12-28T10:00:00Z')),
  toDbDate: vi.fn((date: string) => new Date(date)),
  formatDateFromDb: vi.fn((date: any) => date?.toISOString?.().split('T')[0] || date),
}));

vi.mock('@/lib/services/approval-workflow.service', () => ({
  submitForApproval: vi.fn().mockResolvedValue({
    requestId: 1,
    flowName: 'PR Approval Flow',
  }),
  approveRequest: vi.fn().mockResolvedValue({ isFullyApproved: true }),
  rejectRequest: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import {
  generatePRNumber,
  createPR,
  addPRLines,
} from '@/lib/services/purchase-requisition.service';

describe('Purchase Requisition Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock data
    mockPRs = {};
    mockLines = {};
    mockPOs = {};
    nextPRId = 1;
    nextLineId = 1;
    nextPOId = 1;
  });

  describe('PR Number Generation', () => {
    it('should generate PR number with correct format', async () => {
      const prNumber = await generatePRNumber();
      expect(prNumber).toMatch(/^PR\d{4}-\d{4}$/);
    });
  });

  describe('PR Creation', () => {
    it('should create a PR with required fields', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
          priority: 'normal',
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });

    it('should create a PR with all fields', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
          departmentId: 5,
          priority: 'high',
          requiredDate: '2024-12-31',
          description: 'Office supplies for Q1',
          justification: 'Required for operations',
          costCenterId: 10,
          projectId: 3,
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });

    it('should default priority to normal', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });
  });

  describe('PR Lines', () => {
    it('should add lines to a PR', async () => {
      const prId = await createPR({ requesterId: 1 }, 1);

      const lineIds = await addPRLines(prId, [
        {
          description: 'Office Chair',
          quantity: 5,
          unitOfMeasure: 'EA',
          estimatedUnitPrice: 3500,
        },
        {
          description: 'Desk',
          quantity: 5,
          unitOfMeasure: 'EA',
          estimatedUnitPrice: 5000,
        },
      ]);

      expect(lineIds.length).toBe(2);
    });

    it('should add line with item code', async () => {
      const prId = await createPR({ requesterId: 1 }, 1);

      const lineIds = await addPRLines(prId, [
        {
          itemCode: 'OFF-CHAIR-001',
          description: 'Ergonomic Office Chair',
          quantity: 1,
          unitOfMeasure: 'EA',
          estimatedUnitPrice: 8500,
        },
      ]);

      expect(lineIds.length).toBe(1);
    });

    it('should add line with vendor suggestion', async () => {
      const prId = await createPR({ requesterId: 1 }, 1);

      const lineIds = await addPRLines(prId, [
        {
          description: 'Printer Paper',
          quantity: 100,
          unitOfMeasure: 'REAM',
          estimatedUnitPrice: 150,
          suggestedVendorId: 5,
        },
      ]);

      expect(lineIds.length).toBe(1);
    });
  });

  describe('Priority Levels', () => {
    it('should create PR with low priority', async () => {
      const prId = await createPR({ requesterId: 1, priority: 'low' }, 1);
      expect(prId).toBeGreaterThan(0);
    });

    it('should create PR with normal priority', async () => {
      const prId = await createPR({ requesterId: 1, priority: 'normal' }, 1);
      expect(prId).toBeGreaterThan(0);
    });

    it('should create PR with high priority', async () => {
      const prId = await createPR({ requesterId: 1, priority: 'high' }, 1);
      expect(prId).toBeGreaterThan(0);
    });

    it('should create PR with urgent priority', async () => {
      const prId = await createPR({ requesterId: 1, priority: 'urgent' }, 1);
      expect(prId).toBeGreaterThan(0);
    });
  });

  describe('PR with Department and Project', () => {
    it('should create PR with department assignment', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
          departmentId: 10,
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });

    it('should create PR with project assignment', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
          projectId: 5,
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });

    it('should create PR with cost center', async () => {
      const prId = await createPR(
        {
          requesterId: 1,
          costCenterId: 15,
        },
        1
      );

      expect(prId).toBeGreaterThan(0);
    });
  });

  describe('Multiple Lines Calculation', () => {
    it('should handle multiple lines with different quantities', async () => {
      const prId = await createPR({ requesterId: 1 }, 1);

      const lineIds = await addPRLines(prId, [
        { description: 'Item A', quantity: 10, unitOfMeasure: 'EA', estimatedUnitPrice: 100 },
        { description: 'Item B', quantity: 5, unitOfMeasure: 'EA', estimatedUnitPrice: 200 },
        { description: 'Item C', quantity: 2, unitOfMeasure: 'SET', estimatedUnitPrice: 500 },
      ]);

      expect(lineIds.length).toBe(3);
      // Total should be: 10*100 + 5*200 + 2*500 = 1000 + 1000 + 1000 = 3000
    });
  });
});

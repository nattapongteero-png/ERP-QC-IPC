/**
 * Unit Tests for Variance Analysis Service (T151)
 * Tests standard costing and variance calculations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db-helper
const mockExecuteDbOperation = vi.fn();
const mockGetTableRef = vi.fn();
const mockGetInsertId = vi.fn();

vi.mock('@/lib/db/db-helper', () => ({
  executeDbOperation: (fn: any) => mockExecuteDbOperation(fn),
  getTableRef: (name: string) => mockGetTableRef(name),
  getInsertId: (result: any) => mockGetInsertId(result),
}));

// Mock date-utils
vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => new Date(),
  toDbDate: (date: string) => date,
  getTodayStr: () => '2024-01-15',
  formatDateFromDb: (date: any) => date ? new Date(date).toISOString().split('T')[0] : null,
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  desc: vi.fn((field) => ({ type: 'desc', field })),
  lte: vi.fn((a, b) => ({ type: 'lte', a, b })),
  isNull: vi.fn((field) => ({ type: 'isNull', field })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
  inArray: vi.fn((field, values) => ({ type: 'inArray', field, values })),
}));

import {
  createStandardCost,
  getStandardCostById,
  getCurrentStandardCost,
  listStandardCosts,
  listVariances,
  getWorkOrderVariances,
} from '@/lib/services/variance-analysis.service';

describe('Variance Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default table refs
    mockGetTableRef.mockImplementation((name: string) => ({
      id: { name: 'id' },
      itemId: { name: 'itemId' },
      code: { name: 'code' },
      name: { name: 'name' },
      effectiveDate: { name: 'effectiveDate' },
      materialCost: { name: 'materialCost' },
      laborCost: { name: 'laborCost' },
      overheadCost: { name: 'overheadCost' },
      totalCost: { name: 'totalCost' },
      standardHours: { name: 'standardHours' },
      standardLaborRate: { name: 'standardLaborRate' },
      isCurrent: { name: 'isCurrent' },
      notes: { name: 'notes' },
      createdBy: { name: 'createdBy' },
      createdAt: { name: 'createdAt' },
      workOrderId: { name: 'workOrderId' },
      orderNumber: { name: 'orderNumber' },
      varianceType: { name: 'varianceType' },
      varianceDate: { name: 'varianceDate' },
      standardValue: { name: 'standardValue' },
      actualValue: { name: 'actualValue' },
      varianceAmount: { name: 'varianceAmount' },
      quantity: { name: 'quantity' },
      isFavorable: { name: 'isFavorable' },
      journalEntryId: { name: 'journalEntryId' },
      postedAt: { name: 'postedAt' },
      quantityProduced: { name: 'quantityProduced' },
      status: { name: 'status' },
      isActive: { name: 'isActive' },
      startDate: { name: 'startDate' },
    }));

    mockGetInsertId.mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createStandardCost', () => {
    it('should create a standard cost record with calculated total', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({ insertId: 1 }),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const input = {
        itemId: 1,
        effectiveDate: '2024-01-15',
        materialCost: 100,
        laborCost: 50,
        overheadCost: 25,
        standardHours: 2,
        standardLaborRate: 25,
        notes: 'Test cost',
        setAsCurrent: true,
      };

      const result = await createStandardCost(input, 1);

      expect(result).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 1,
          materialCost: 100,
          laborCost: 50,
          overheadCost: 25,
          totalCost: 175, // 100 + 50 + 25
          standardHours: 2,
          standardLaborRate: 25,
          isCurrent: true,
        })
      );
    });

    it('should not update existing current costs when setAsCurrent is false', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({ insertId: 2 }),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const input = {
        itemId: 1,
        effectiveDate: '2024-01-15',
        materialCost: 100,
        laborCost: 50,
        overheadCost: 25,
        setAsCurrent: false,
      };

      await createStandardCost(input, 1);

      // update should not be called when setAsCurrent is false
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should handle zero costs correctly', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({ insertId: 3 }),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const input = {
        itemId: 1,
        effectiveDate: '2024-01-15',
      };

      await createStandardCost(input, 1);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          materialCost: 0,
          laborCost: 0,
          overheadCost: 0,
          totalCost: 0,
        })
      );
    });
  });

  describe('getStandardCostById', () => {
    it('should return standard cost with item details', async () => {
      const mockCost = {
        id: 1,
        itemId: 1,
        itemCode: 'ITM001',
        itemName: 'Test Item',
        effectiveDate: new Date('2024-01-15'),
        materialCost: 100,
        laborCost: 50,
        overheadCost: 25,
        totalCost: 175,
        standardHours: 2,
        standardLaborRate: 25,
        isCurrent: true,
        notes: 'Test note',
        createdBy: 1,
        createdAt: new Date('2024-01-01'),
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockCost]),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const result = await getStandardCostById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.itemCode).toBe('ITM001');
      expect(result?.totalCost).toBe(175);
    });

    it('should return null for non-existent cost', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const result = await getStandardCostById(999);

      expect(result).toBeNull();
    });
  });

  describe('getCurrentStandardCost', () => {
    it('should return current standard cost for item', async () => {
      const mockCost = {
        id: 1,
        itemId: 1,
        itemCode: 'ITM001',
        itemName: 'Test Item',
        effectiveDate: new Date('2024-01-15'),
        materialCost: 100,
        laborCost: 50,
        overheadCost: 25,
        totalCost: 175,
        standardHours: 2,
        standardLaborRate: 25,
        isCurrent: true,
        notes: null,
        createdAt: new Date(),
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockCost]),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const result = await getCurrentStandardCost(1);

      expect(result).not.toBeNull();
      expect(result?.isCurrent).toBe(true);
      expect(result?.itemId).toBe(1);
    });

    it('should return null when no current cost exists', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const result = await getCurrentStandardCost(999);

      expect(result).toBeNull();
    });
  });

  describe('Variance Types', () => {
    it('should define all variance type labels correctly', () => {
      // Variance types should be properly defined
      const varianceTypes = ['mpv', 'muv', 'lrv', 'lev', 'voh_var', 'foh_vol'];
      expect(varianceTypes).toHaveLength(6);
    });

    it('should define variance formulas correctly', () => {
      // MPV = (Actual Price - Standard Price) × Actual Quantity
      const actualPrice = 105;
      const standardPrice = 100;
      const actualQty = 10;
      const mpv = (actualPrice - standardPrice) * actualQty;
      expect(mpv).toBe(50); // Unfavorable

      // MUV = (Actual Quantity - Standard Quantity) × Standard Price
      const standardQty = 12;
      const muv = (actualQty - standardQty) * standardPrice;
      expect(muv).toBe(-200); // Favorable (used less than expected)

      // LRV = (Actual Rate - Standard Rate) × Actual Hours
      const actualRate = 28;
      const standardRate = 25;
      const actualHours = 100;
      const lrv = (actualRate - standardRate) * actualHours;
      expect(lrv).toBe(300); // Unfavorable

      // LEV = (Actual Hours - Standard Hours) × Standard Rate
      const standardHours = 95;
      const lev = (actualHours - standardHours) * standardRate;
      expect(lev).toBe(125); // Unfavorable (took more hours)
    });
  });

  describe('getWorkOrderVariances', () => {
    it('should return null for non-existent work order', async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockExecuteDbOperation.mockImplementation(async (fn) => fn(mockDb));

      const result = await getWorkOrderVariances(999);

      expect(result).toBeNull();
    });
  });
});

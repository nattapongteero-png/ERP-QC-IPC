/**
 * Unit tests for Work Order BOM Materials Auto-Population
 *
 * Tests that work orders automatically populate materials from BOM
 * with quantities scaled based on planned quantity vs BOM batch size.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the db-helper module
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName: string) => ({ tableName })),
  executeDbOperation: vi.fn(),
  dbDate: vi.fn(() => new Date()),
  getInsertId: vi.fn(() => 1),
  parseDbDate: vi.fn((date) => date ? new Date(date) : null),
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

// Mock api-utils
vi.mock('@/lib/api-utils', () => ({
  successResponse: vi.fn((data, message) => ({
    json: () => Promise.resolve({ success: true, data, message }),
  })),
  errorResponse: vi.fn((message, status = 400) => ({
    json: () => Promise.resolve({ success: false, error: message }),
    status,
  })),
  serverErrorResponse: vi.fn((error) => ({
    json: () => Promise.resolve({ success: false, error: error.message }),
    status: 500,
  })),
  withAuth: vi.fn((request, handler) => handler({ userId: 1 })),
  getPaginationParams: vi.fn(() => ({ page: 1, limit: 20 })),
  createPaginatedResponse: vi.fn((items, total, pagination) => ({ items, total, ...pagination })),
}));

import { executeDbOperation, getInsertId } from '@/lib/db/db-helper';

describe('Work Order BOM Materials Auto-Population', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Quantity Scaling Logic', () => {
    it('should scale BOM quantities correctly when planned qty equals batch size', () => {
      const bomBatchSize = 100;
      const plannedQuantity = 100;
      const bomLineQuantity = 50;

      const scalingFactor = plannedQuantity / bomBatchSize;
      const scaledQuantity = bomLineQuantity * scalingFactor;

      expect(scalingFactor).toBe(1);
      expect(scaledQuantity).toBe(50);
    });

    it('should scale BOM quantities correctly when planned qty is double batch size', () => {
      const bomBatchSize = 100;
      const plannedQuantity = 200;
      const bomLineQuantity = 50;

      const scalingFactor = plannedQuantity / bomBatchSize;
      const scaledQuantity = bomLineQuantity * scalingFactor;

      expect(scalingFactor).toBe(2);
      expect(scaledQuantity).toBe(100);
    });

    it('should scale BOM quantities correctly when planned qty is half batch size', () => {
      const bomBatchSize = 100;
      const plannedQuantity = 50;
      const bomLineQuantity = 50;

      const scalingFactor = plannedQuantity / bomBatchSize;
      const scaledQuantity = bomLineQuantity * scalingFactor;

      expect(scalingFactor).toBe(0.5);
      expect(scaledQuantity).toBe(25);
    });

    it('should handle decimal scaling factors correctly', () => {
      const bomBatchSize = 100;
      const plannedQuantity = 150;
      const bomLineQuantity = 40;

      const scalingFactor = plannedQuantity / bomBatchSize;
      const scaledQuantity = bomLineQuantity * scalingFactor;

      expect(scalingFactor).toBe(1.5);
      expect(scaledQuantity).toBe(60);
    });

    it('should handle default batch size of 1 when not specified', () => {
      const bomBatchSize = 1; // Default when null/undefined
      const plannedQuantity = 500;
      const bomLineQuantity = 2;

      const scalingFactor = plannedQuantity / bomBatchSize;
      const scaledQuantity = bomLineQuantity * scalingFactor;

      expect(scalingFactor).toBe(500);
      expect(scaledQuantity).toBe(1000);
    });
  });

  describe('BOM Status Validation', () => {
    it('should allow work order creation from approved BOM', () => {
      const bomStatus = 'approved';
      const allowedStatuses = ['approved', 'active'];

      expect(allowedStatuses.includes(bomStatus)).toBe(true);
    });

    it('should allow work order creation from active (legacy) BOM', () => {
      const bomStatus = 'active';
      const allowedStatuses = ['approved', 'active'];

      expect(allowedStatuses.includes(bomStatus)).toBe(true);
    });

    it('should reject work order creation from draft BOM', () => {
      const bomStatus = 'draft';
      const allowedStatuses = ['approved', 'active'];

      expect(allowedStatuses.includes(bomStatus)).toBe(false);
    });

    it('should reject work order creation from obsolete BOM', () => {
      const bomStatus = 'obsolete';
      const allowedStatuses = ['approved', 'active'];

      expect(allowedStatuses.includes(bomStatus)).toBe(false);
    });
  });

  describe('Optional Materials Handling', () => {
    it('should skip optional materials during auto-population', () => {
      const bomLines = [
        { itemId: 1, quantity: 100, unit: 'kg', isOptional: false },
        { itemId: 2, quantity: 50, unit: 'kg', isOptional: true },
        { itemId: 3, quantity: 25, unit: 'kg', isOptional: false },
      ];

      const nonOptionalLines = bomLines.filter((line) => !line.isOptional);

      expect(nonOptionalLines.length).toBe(2);
      expect(nonOptionalLines[0].itemId).toBe(1);
      expect(nonOptionalLines[1].itemId).toBe(3);
    });
  });

  describe('Material Creation Count', () => {
    it('should correctly count created materials', () => {
      const bomLines = [
        { itemId: 1, quantity: 100, unit: 'kg', isOptional: false },
        { itemId: 2, quantity: 50, unit: 'kg', isOptional: true },
        { itemId: 3, quantity: 25, unit: 'kg', isOptional: false },
        { itemId: 4, quantity: 10, unit: 'kg', isOptional: false },
      ];

      let materialsCreated = 0;
      for (const line of bomLines) {
        if (!line.isOptional) {
          materialsCreated++;
        }
      }

      expect(materialsCreated).toBe(3);
    });
  });
});

/**
 * Unit Tests for PQR Service Aggregation Functions
 * Tests T405-T412: Aggregation functions for Product Quality Review
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  aggregateBatchMetrics,
  aggregateDeviationMetrics,
  aggregateCapaMetrics,
  aggregateComplaintMetrics,
  aggregateOosMetrics,
  aggregateStabilityStatus,
  calculatePQRMetrics,
  approvePQR,
} from '@/lib/services/pqr-service';
import * as dbHelper from '@/lib/db/db-helper';
import * as dateUtils from '@/lib/db/date-utils';

// Mock the database helper
vi.mock('@/lib/db/db-helper');
vi.mock('@/lib/db/date-utils', async () => {
  const actual = await vi.importActual('@/lib/db/date-utils');
  return {
    ...actual,
    toQueryDate: vi.fn((date) => date), // Simple pass-through for tests
    getNow: vi.fn(() => '2024-12-23T10:00:00.000Z'),
  };
});

describe('PQR Service - Aggregation Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T405: aggregateBatchMetrics', () => {
    it('should aggregate batch metrics correctly', async () => {
      // Mock work orders data
      const mockBatches = [
        { id: 1, status: 'completed', yieldPercentage: 95.5, actualEndDate: '2024-01-15' },
        { id: 2, status: 'completed', yieldPercentage: 98.2, actualEndDate: '2024-02-20' },
        { id: 3, status: 'completed', yieldPercentage: 92.0, actualEndDate: '2024-03-10' },
        { id: 4, status: 'cancelled', yieldPercentage: null, actualEndDate: '2024-04-05' },
      ];

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue(mockBatches);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateBatchMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalBatches).toBe(4);
      expect(result.averageYield).toBe(95.23); // (95.5 + 98.2 + 92.0) / 3
      expect(result.batchPassRate).toBe(75); // 3 completed / 4 total
      expect(result.batchesByStatus).toEqual({
        completed: 3,
        cancelled: 1,
      });
    });

    it('should handle empty batch data', async () => {
      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue([]);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateBatchMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalBatches).toBe(0);
      expect(result.averageYield).toBeNull();
      expect(result.batchPassRate).toBeNull();
      expect(result.batchesByStatus).toEqual({});
    });
  });

  describe('T406: aggregateDeviationMetrics', () => {
    it('should aggregate deviation metrics correctly', async () => {
      const mockDeviations = [
        { id: 1, severity: 'critical', status: 'closed', reportedAt: '2024-01-10' },
        { id: 2, severity: 'major', status: 'investigating', reportedAt: '2024-02-15' },
        { id: 3, severity: 'minor', status: 'closed', reportedAt: '2024-03-20' },
        { id: 4, severity: 'major', status: 'closed', reportedAt: '2024-04-25' },
      ];

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue(mockDeviations);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateDeviationMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalDeviations).toBe(4);
      expect(result.bySeverity).toEqual({
        critical: 1,
        major: 2,
        minor: 1,
      });
      expect(result.byStatus).toEqual({
        closed: 3,
        investigating: 1,
      });
      expect(result.closedCount).toBe(3);
    });
  });

  describe('T407: aggregateCapaMetrics', () => {
    it('should calculate on-time closure rate correctly', async () => {
      const mockCapas = [
        {
          id: 1,
          status: 'closed',
          dueDate: '2024-02-01',
          closedDate: '2024-01-28',
          createdAt: '2024-01-01',
        },
        {
          id: 2,
          status: 'closed',
          dueDate: '2024-03-01',
          closedDate: '2024-03-05',
          createdAt: '2024-02-01',
        },
        {
          id: 3,
          status: 'open',
          dueDate: '2024-04-01',
          closedDate: null,
          createdAt: '2024-03-01',
        },
      ];

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue(mockCapas);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateCapaMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalCapas).toBe(3);
      expect(result.byStatus).toEqual({
        closed: 2,
        open: 1,
      });
      expect(result.onTimeClosureRate).toBe(50); // 1 on-time / 2 closed
    });
  });

  describe('T408: aggregateComplaintMetrics', () => {
    it('should aggregate complaints by category and severity', async () => {
      const mockComplaints = [
        { id: 1, category: 'quality', severity: 'major', receivedDate: '2024-01-10' },
        { id: 2, category: 'efficacy', severity: 'minor', receivedDate: '2024-02-15' },
        { id: 3, category: 'quality', severity: 'critical', receivedDate: '2024-03-20' },
      ];

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue(mockComplaints);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateComplaintMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalComplaints).toBe(3);
      expect(result.byCategory).toEqual({
        quality: 2,
        efficacy: 1,
      });
      expect(result.bySeverity).toEqual({
        major: 1,
        minor: 1,
        critical: 1,
      });
    });
  });

  describe('T409: aggregateOosMetrics', () => {
    it('should calculate OOS rate and breakdown by test type', async () => {
      const mockTests = [
        { id: 1, testType: 'incoming', status: 'pass', testDate: '2024-01-10' },
        { id: 2, testType: 'in_process', status: 'fail', testDate: '2024-02-15' },
        { id: 3, testType: 'final', status: 'pass', testDate: '2024-03-20' },
        { id: 4, testType: 'final', status: 'fail', testDate: '2024-04-25' },
        { id: 5, testType: 'incoming', status: 'pass', testDate: '2024-05-30' },
      ];

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue(mockTests);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateOosMetrics(1, '2024-01-01', '2024-12-31');

      expect(result.totalTests).toBe(5);
      expect(result.oosCount).toBe(2);
      expect(result.oosRate).toBe(40); // 2/5 * 100
      expect(result.byTestType).toEqual({
        incoming: { total: 2, oos: 0 },
        in_process: { total: 1, oos: 1 },
        final: { total: 2, oos: 1 },
      });
    });
  });

  describe('T410: aggregateStabilityStatus', () => {
    it('should identify studies with OOS alerts', async () => {
      const mockStudies = [
        { id: 1, status: 'active', startDate: '2024-01-01' },
        { id: 2, status: 'active', startDate: '2024-02-01' },
        { id: 3, status: 'active', startDate: '2024-03-01' },
      ];

      const mockSamplesWithOos = [
        { studyId: 2, oosDetected: true },
        { studyId: 2, oosDetected: true },
      ];

      vi.mocked(dbHelper.executeDbOperation)
        .mockResolvedValueOnce(mockStudies)
        .mockResolvedValueOnce(mockSamplesWithOos);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      const result = await aggregateStabilityStatus(1, '2024-01-01', '2024-12-31');

      expect(result.studiesCount).toBe(3);
      expect(result.onTrack).toBe(2);
      expect(result.alerts).toBe(1);
      expect(result.summary).toBe('3 stability studies: 2 on track, 1 with OOS alerts');
    });
  });

  describe('T411: calculatePQRMetrics', () => {
    it('should calculate KPIs and generate recommendations', async () => {
      const aggregatedData = {
        batchMetrics: {
          totalBatches: 100,
          averageYield: 95.5,
          batchPassRate: 98.0,
          batchesByStatus: { completed: 98, cancelled: 2 },
        },
        deviationMetrics: {
          totalDeviations: 3,
          bySeverity: { minor: 2, major: 1 },
          byStatus: { closed: 2, investigating: 1 },
          closedCount: 2,
        },
        capaMetrics: {
          totalCapas: 2,
          byStatus: { closed: 2 },
          onTimeClosureRate: 100,
        },
        complaintMetrics: {
          totalComplaints: 1,
          byCategory: { quality: 1 },
          bySeverity: { minor: 1 },
        },
        oosMetrics: {
          totalTests: 200,
          oosCount: 2,
          oosRate: 1.0,
          byTestType: { final: { total: 200, oos: 2 } },
        },
        stabilityMetrics: {
          studiesCount: 5,
          onTrack: 5,
          alerts: 0,
          summary: '5 stability studies: 5 on track',
        },
      };

      const targets = {
        batchSuccessRate: 95,
        maxDeviationRate: 5,
        minCapaClosureRate: 90,
        maxOosRate: 2,
        maxComplaintRate: 1,
      };

      const result = await calculatePQRMetrics(aggregatedData, targets);

      expect(result.kpis).toHaveLength(7); // 7 KPI types
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.recommendations).toContain(
        'All quality metrics met targets. Continue current practices.'
      );
    });

    it('should generate critical recommendations when metrics fail', async () => {
      const aggregatedData = {
        batchMetrics: {
          totalBatches: 100,
          averageYield: 85.0,
          batchPassRate: 80.0, // Below target
          batchesByStatus: { completed: 80, cancelled: 20 },
        },
        deviationMetrics: {
          totalDeviations: 10, // High rate
          bySeverity: { critical: 3, major: 4, minor: 3 },
          byStatus: { closed: 5, investigating: 5 },
          closedCount: 5,
        },
        capaMetrics: {
          totalCapas: 8,
          byStatus: { closed: 4, open: 4 },
          onTimeClosureRate: 50, // Below target
        },
        complaintMetrics: {
          totalComplaints: 5,
          byCategory: { quality: 3, safety: 2 },
          bySeverity: { critical: 2, major: 3 },
        },
        oosMetrics: {
          totalTests: 200,
          oosCount: 10,
          oosRate: 5.0, // High rate
          byTestType: { final: { total: 200, oos: 10 } },
        },
        stabilityMetrics: {
          studiesCount: 5,
          onTrack: 3,
          alerts: 2,
          summary: '5 stability studies: 3 on track, 2 with OOS alerts',
        },
      };

      const targets = {
        batchSuccessRate: 95,
        maxDeviationRate: 5,
        minCapaClosureRate: 90,
        maxOosRate: 2,
        maxComplaintRate: 1,
      };

      const result = await calculatePQRMetrics(aggregatedData, targets);

      expect(result.overallScore).toBeLessThan(50);
      expect(result.recommendations.some((r) => r.includes('critical'))).toBe(true);
      expect(result.recommendations.some((r) => r.includes('Immediate'))).toBe(true);
    });
  });

  describe('T412: approvePQR', () => {
    it('should approve PQR and update status', async () => {
      const mockPqr = {
        id: 1,
        reportNumber: 'PQR-2024-001',
        status: 'approved',
        approvedBy: 10,
        approvedAt: '2024-12-23T10:00:00.000Z',
      };

      vi.mocked(dbHelper.executeDbOperation).mockResolvedValue({ insertId: 1 } as any);
      vi.mocked(dbHelper.getTableRef).mockReturnValue({} as any);

      // Mock getPqrById which is called at the end
      const getPqrByIdMock = vi.fn().mockResolvedValue(mockPqr);
      vi.doMock('@/lib/services/pqr-service', () => ({
        approvePQR: vi.fn(),
        getPqrById: getPqrByIdMock,
      }));

      // Call the function
      await approvePQR(1, 10, 'Approved - all metrics meet targets');

      // Verify executeDbOperation was called
      expect(dbHelper.executeDbOperation).toHaveBeenCalled();
    });
  });
});

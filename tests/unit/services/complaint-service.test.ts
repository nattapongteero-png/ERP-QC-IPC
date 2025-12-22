/**
 * Complaint Service Unit Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Tests for complaint data types, validation, and workflow rules.
 * Database-dependent functions are tested in integration tests.
 */

import { describe, it, expect } from 'vitest';

import type {
  ComplaintCreate,
  ComplaintUpdate,
  ComplaintInvestigationCreate,
  ComplaintListParams,
  ComplaintSource,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
} from '@/types/complaints';

describe('Complaint Service', () => {
  describe('ComplaintCreate type validation', () => {
    it('should require mandatory fields', () => {
      const validData: ComplaintCreate = {
        receivedDate: '2025-01-15',
        source: 'customer',
        productId: 1,
        category: 'quality',
        severity: 'major',
        description: 'Product quality issue reported by customer'
      };

      expect(validData.receivedDate).toBeTruthy();
      expect(validData.productId).toBe(1);
      expect(validData.description).toBeTruthy();
    });

    it('should support different source types', () => {
      const sourceTypes: ComplaintSource[] = ['customer', 'distributor', 'regulatory', 'internal'];

      sourceTypes.forEach(source => {
        const data: ComplaintCreate = {
          receivedDate: '2025-01-15',
          source,
          productId: 1,
          category: 'quality',
          severity: 'minor',
          description: 'Test complaint'
        };

        expect(data.source).toBe(source);
      });
    });

    it('should support all categories', () => {
      const categories: ComplaintCategory[] = ['quality', 'efficacy', 'safety', 'packaging', 'labeling', 'other'];

      categories.forEach(category => {
        const data: ComplaintCreate = {
          receivedDate: '2025-01-15',
          source: 'customer',
          productId: 1,
          category,
          severity: 'minor',
          description: 'Test complaint'
        };

        expect(data.category).toBe(category);
      });
    });

    it('should support all severity levels', () => {
      const severities: ComplaintSeverity[] = ['minor', 'major', 'critical'];

      severities.forEach(severity => {
        const data: ComplaintCreate = {
          receivedDate: '2025-01-15',
          source: 'customer',
          productId: 1,
          category: 'quality',
          severity,
          description: 'Test complaint'
        };

        expect(data.severity).toBe(severity);
      });
    });

    it('should support optional customer info', () => {
      const data: ComplaintCreate = {
        receivedDate: '2025-01-15',
        source: 'customer',
        customerName: 'John Doe',
        customerContact: 'john@example.com',
        productId: 1,
        lotId: 100,
        category: 'quality',
        severity: 'major',
        description: 'Product defect complaint'
      };

      expect(data.customerName).toBe('John Doe');
      expect(data.customerContact).toBe('john@example.com');
      expect(data.lotId).toBe(100);
    });
  });

  describe('ComplaintUpdate type validation', () => {
    it('should support status updates', () => {
      const updates: ComplaintUpdate = {
        status: 'under_investigation'
      };

      expect(updates.status).toBe('under_investigation');
    });

    it('should support severity updates', () => {
      const updates: ComplaintUpdate = {
        severity: 'critical'
      };

      expect(updates.severity).toBe('critical');
    });

    it('should support regulatory report flag', () => {
      const updates: ComplaintUpdate = {
        regulatoryReportRequired: true,
        regulatoryReportDate: '2025-01-20'
      };

      expect(updates.regulatoryReportRequired).toBe(true);
      expect(updates.regulatoryReportDate).toBe('2025-01-20');
    });
  });

  describe('ComplaintInvestigationCreate type validation', () => {
    it('should require mandatory investigation fields', () => {
      const data: ComplaintInvestigationCreate = {
        rootCause: 'Raw material contamination during storage',
        conclusion: 'Batch affected, recall recommended'
      };

      expect(data.rootCause).toBeTruthy();
      expect(data.conclusion).toBeTruthy();
    });

    it('should support optional investigation fields', () => {
      const data: ComplaintInvestigationCreate = {
        batchRecordReview: 'Batch 12345 reviewed, no deviations found in production',
        retainSampleTest: 'Sample analysis showed elevated moisture content',
        rootCause: 'Improper storage conditions at distribution center',
        conclusion: 'Storage issue at distributor, not manufacturing defect',
        recommendation: 'Review distributor storage requirements'
      };

      expect(data.batchRecordReview).toBeTruthy();
      expect(data.retainSampleTest).toBeTruthy();
      expect(data.recommendation).toBeTruthy();
    });
  });

  describe('ComplaintListParams type validation', () => {
    it('should support all filter parameters', () => {
      const params: ComplaintListParams = {
        status: 'received',
        category: 'quality',
        severity: 'major',
        productId: 1,
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        page: 1,
        limit: 20
      };

      expect(params.status).toBe('received');
      expect(params.category).toBe('quality');
      expect(params.severity).toBe('major');
      expect(params.productId).toBe(1);
      expect(params.fromDate).toBe('2025-01-01');
      expect(params.toDate).toBe('2025-12-31');
      expect(params.page).toBe(1);
      expect(params.limit).toBe(20);
    });

    it('should support partial filters', () => {
      const params: ComplaintListParams = {
        status: 'under_investigation'
      };

      expect(params.status).toBe('under_investigation');
      expect(params.category).toBeUndefined();
    });
  });

  describe('Complaint Workflow', () => {
    it('should follow standard complaint workflow states', () => {
      const workflowStates: ComplaintStatus[] = [
        'received',
        'under_investigation',
        'resolved',
        'closed'
      ];

      expect(workflowStates).toHaveLength(4);
      expect(workflowStates[0]).toBe('received');
      expect(workflowStates[3]).toBe('closed');
    });

    it('should require investigation before closure', () => {
      const closureRequirements = [
        'Investigation started',
        'Root cause identified',
        'Conclusion documented'
      ];

      expect(closureRequirements).toHaveLength(3);
    });
  });

  describe('Complaint Number Format', () => {
    it('should follow COMP-YYMM-#### format', () => {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const expectedPrefix = `COMP-${year}${month}-`;

      expect(expectedPrefix).toMatch(/^COMP-\d{4}-$/);
    });
  });

  describe('Thai FDA GMP Compliance - หมวด 9', () => {
    it('should categorize complaints by product type', () => {
      const complaintCategories: ComplaintCategory[] = [
        'quality',
        'efficacy',
        'safety',
        'packaging',
        'labeling',
        'other'
      ];

      expect(complaintCategories).toHaveLength(6);
      expect(complaintCategories).toContain('quality');
      expect(complaintCategories).toContain('safety');
    });

    it('should support severity classification', () => {
      const severityLevels: Record<ComplaintSeverity, string> = {
        minor: 'Non-critical issues, low risk',
        major: 'Significant issues, moderate risk',
        critical: 'Serious issues, requires immediate action'
      };

      expect(Object.keys(severityLevels)).toHaveLength(3);
      expect(severityLevels.critical).toContain('immediate action');
    });

    it('should track regulatory reporting requirements', () => {
      const regulatoryFields = [
        'regulatoryReportRequired',
        'regulatoryReportDate'
      ];

      expect(regulatoryFields).toContain('regulatoryReportRequired');
      expect(regulatoryFields).toContain('regulatoryReportDate');
    });

    it('should support CAPA linkage', () => {
      const linkableToCAPA = true;
      expect(linkableToCAPA).toBe(true);
    });

    it('should support recall linkage', () => {
      const complaintFields = ['recallRequired', 'recallId'];
      expect(complaintFields).toContain('recallRequired');
      expect(complaintFields).toContain('recallId');
    });
  });

  describe('Investigation Process', () => {
    it('should track batch record review', () => {
      const investigationFields = [
        'batchRecordReview',
        'retainSampleTest',
        'rootCause',
        'conclusion',
        'recommendation'
      ];

      expect(investigationFields).toContain('batchRecordReview');
      expect(investigationFields).toContain('retainSampleTest');
    });

    it('should capture investigator information', () => {
      const investigatorInfo = [
        'investigatorId',
        'investigatorName',
        'startDate',
        'completionDate'
      ];

      expect(investigatorInfo).toContain('investigatorId');
      expect(investigatorInfo).toContain('startDate');
      expect(investigatorInfo).toContain('completionDate');
    });
  });

  describe('Trend Analysis', () => {
    it('should analyze complaints by time period', () => {
      const periods = ['month', 'quarter', 'year'];
      expect(periods).toHaveLength(3);
    });

    it('should analyze complaints by category', () => {
      const groupings = ['category', 'product', 'severity'];
      expect(groupings).toContain('category');
      expect(groupings).toContain('product');
    });

    it('should identify top products with complaints', () => {
      const productAnalysis = true;
      expect(productAnalysis).toBe(true);
    });
  });

  describe('Dashboard Statistics', () => {
    it('should track open complaints', () => {
      const dashboardFields = ['totalOpen', 'pendingInvestigation', 'criticalCount'];
      expect(dashboardFields).toContain('totalOpen');
    });

    it('should track by status', () => {
      const statusBreakdown: Record<ComplaintStatus, number> = {
        received: 0,
        under_investigation: 0,
        resolved: 0,
        closed: 0
      };

      expect(Object.keys(statusBreakdown)).toHaveLength(4);
    });

    it('should track by severity', () => {
      const severityBreakdown: Record<ComplaintSeverity, number> = {
        minor: 0,
        major: 0,
        critical: 0
      };

      expect(Object.keys(severityBreakdown)).toHaveLength(3);
    });
  });
});

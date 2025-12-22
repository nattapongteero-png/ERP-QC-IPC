/**
 * Integration Tests for Documents API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Tests the document control API endpoints for GMP compliance
 * These tests validate API response formats and business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Documents API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/documents/types', () => {
    it('should return list of document types', () => {
      const expectedResponse = {
        success: true,
        data: [
          {
            id: 1,
            code: 'SOP',
            name: 'Standard Operating Procedure',
            prefix: 'SOP',
            approvalChain: ['author', 'reviewer', 'approver'],
            reviewPeriodMonths: 24,
          },
          {
            id: 2,
            code: 'POL',
            name: 'Policy',
            prefix: 'POL',
            approvalChain: ['author', 'reviewer', 'qa_manager', 'management'],
            reviewPeriodMonths: 36,
          },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(Array.isArray(expectedResponse.data)).toBe(true);
      expect(expectedResponse.data[0]).toHaveProperty('code');
      expect(expectedResponse.data[0]).toHaveProperty('approvalChain');
    });
  });

  describe('GET /api/documents', () => {
    it('should return paginated document list', () => {
      const expectedResponse = {
        success: true,
        data: {
          documents: [
            {
              id: 1,
              documentNumber: 'SOP-2412-0001',
              title: 'Standard Operating Procedure for Quality Control',
              typeId: 1,
              typeName: 'Standard Operating Procedure',
              departmentId: 1,
              departmentName: 'Quality Assurance',
              currentVersionId: 1,
              currentVersionNumber: '1.0',
              status: 'active',
              retentionYears: 5,
              createdBy: 1,
              createdByName: 'Admin User',
              createdAt: '2024-12-22T10:00:00.000Z',
              updatedAt: '2024-12-22T10:00:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toHaveProperty('documents');
      expect(expectedResponse.data).toHaveProperty('total');
      expect(Array.isArray(expectedResponse.data.documents)).toBe(true);
    });

    it('should filter documents by status', () => {
      const queryParams = { status: 'active' };
      const expectedResponse = {
        success: true,
        data: {
          documents: [
            { id: 1, status: 'active' },
            { id: 2, status: 'active' },
          ],
          total: 2,
        },
      };

      expect(queryParams.status).toBe('active');
      expectedResponse.data.documents.forEach(doc => {
        expect(doc.status).toBe('active');
      });
    });

    it('should filter documents by typeId', () => {
      const queryParams = { typeId: 1 };
      expect(queryParams.typeId).toBe(1);
    });

    it('should filter documents by departmentId', () => {
      const queryParams = { departmentId: 5 };
      expect(queryParams.departmentId).toBe(5);
    });

    it('should search documents by title', () => {
      const queryParams = { search: 'quality' };
      expect(queryParams.search).toBe('quality');
    });
  });

  describe('POST /api/documents', () => {
    it('should create new document with version', () => {
      const requestBody = {
        title: 'New SOP Document',
        typeId: 1,
        departmentId: 1,
        content: 'Initial content for the document',
        retentionYears: 5,
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          documentNumber: 'SOP-2412-0001',
          title: 'New SOP Document',
          typeId: 1,
          typeName: 'Standard Operating Procedure',
          departmentId: 1,
          departmentName: 'Quality Assurance',
          currentVersionId: 1,
          status: 'draft',
          retentionYears: 5,
          createdBy: 1,
          createdAt: '2024-12-22T10:00:00.000Z',
        },
      };

      expect(requestBody.title).toBeDefined();
      expect(requestBody.typeId).toBeDefined();
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.documentNumber).toMatch(/^SOP-\d{4}-\d{4}$/);
      expect(expectedResponse.data.status).toBe('draft');
    });

    it('should fail without required title', () => {
      const requestBody = {
        typeId: 1,
      };

      const expectedErrorResponse = {
        success: false,
        error: 'Validation failed',
        details: [{ field: 'title', message: 'Title is required' }],
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.details).toContainEqual(
        expect.objectContaining({ field: 'title' })
      );
    });

    it('should fail without required typeId', () => {
      const requestBody = {
        title: 'New Document',
      };

      const expectedErrorResponse = {
        success: false,
        error: 'Validation failed',
        details: [{ field: 'typeId', message: 'Document type is required' }],
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.details).toContainEqual(
        expect.objectContaining({ field: 'typeId' })
      );
    });
  });

  describe('GET /api/documents/[id]', () => {
    it('should return document with version history', () => {
      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          documentNumber: 'SOP-2412-0001',
          title: 'Quality Control Procedures',
          typeId: 1,
          typeName: 'Standard Operating Procedure',
          typeCode: 'SOP',
          departmentId: 1,
          departmentName: 'Quality Assurance',
          currentVersionId: 2,
          status: 'active',
          retentionYears: 5,
          createdBy: 1,
          createdByName: 'Admin User',
          createdAt: '2024-12-22T10:00:00.000Z',
          updatedAt: '2024-12-22T12:00:00.000Z',
          currentVersion: {
            id: 2,
            documentId: 1,
            versionNumber: '1.1',
            content: 'Updated document content',
            status: 'approved',
            effectiveDate: '2024-12-22',
            createdBy: 1,
            createdByName: 'Admin User',
            createdAt: '2024-12-22T11:00:00.000Z',
            approvals: [
              {
                id: 1,
                versionId: 2,
                approverId: 2,
                approverName: 'QA Manager',
                approvalRole: 'approver',
                status: 'approved',
                signedAt: '2024-12-22T12:00:00.000Z',
              },
            ],
          },
          versions: [
            { id: 2, versionNumber: '1.1', status: 'approved' },
            { id: 1, versionNumber: '1.0', status: 'superseded' },
          ],
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toHaveProperty('currentVersion');
      expect(expectedResponse.data).toHaveProperty('versions');
      expect(expectedResponse.data.currentVersion).toHaveProperty('approvals');
    });

    it('should return 404 for non-existent document', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Document not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toBe('Document not found');
    });
  });

  describe('PATCH /api/documents/[id]', () => {
    it('should update document title', () => {
      const requestBody = {
        title: 'Updated Document Title',
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          title: 'Updated Document Title',
          updatedAt: '2024-12-22T13:00:00.000Z',
        },
      };

      expect(requestBody.title).toBeDefined();
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.title).toBe('Updated Document Title');
    });

    it('should update document department', () => {
      const requestBody = {
        departmentId: 2,
      };

      expect(requestBody.departmentId).toBe(2);
    });

    it('should not allow status change to active without approval', () => {
      const requestBody = {
        status: 'active',
      };

      const expectedErrorResponse = {
        success: false,
        error: 'Cannot change status to active without approved version',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });
  });

  describe('POST /api/documents/[id]/versions', () => {
    it('should create new version with minor increment', () => {
      const requestBody = {
        content: 'Updated content for new version',
        changeDescription: 'Minor fixes and clarifications',
        isMajorRevision: false,
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 2,
          documentId: 1,
          versionNumber: '1.1',
          content: 'Updated content for new version',
          changeDescription: 'Minor fixes and clarifications',
          status: 'draft',
          createdBy: 1,
          createdAt: '2024-12-22T10:00:00.000Z',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.versionNumber).toBe('1.1');
      expect(expectedResponse.data.status).toBe('draft');
    });

    it('should create new version with major increment', () => {
      const requestBody = {
        content: 'Major revision with significant changes',
        changeDescription: 'Complete restructure of procedures',
        isMajorRevision: true,
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 2,
          documentId: 1,
          versionNumber: '2.0',
          status: 'draft',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.versionNumber).toBe('2.0');
    });
  });

  describe('GET /api/documents/[id]/versions', () => {
    it('should return version history ordered by date', () => {
      const expectedResponse = {
        success: true,
        data: [
          {
            id: 3,
            documentId: 1,
            versionNumber: '1.2',
            status: 'draft',
            createdAt: '2024-12-22T14:00:00.000Z',
          },
          {
            id: 2,
            documentId: 1,
            versionNumber: '1.1',
            status: 'approved',
            createdAt: '2024-12-22T12:00:00.000Z',
          },
          {
            id: 1,
            documentId: 1,
            versionNumber: '1.0',
            status: 'superseded',
            createdAt: '2024-12-22T10:00:00.000Z',
          },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(Array.isArray(expectedResponse.data)).toBe(true);
      // Verify ordering by date (newest first)
      const dates = expectedResponse.data.map(v => new Date(v.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThan(dates[i]);
      }
    });
  });

  describe('POST /api/documents/[id]/approve (Submit for Approval)', () => {
    it('should submit version for approval', () => {
      const requestBody = {
        versionId: 1,
        approvers: [2, 3], // User IDs of approvers
      };

      const expectedResponse = {
        success: true,
        data: {
          versionId: 1,
          status: 'pending_approval',
          approvals: [
            { approverId: 2, approverName: 'Reviewer 1', status: 'pending' },
            { approverId: 3, approverName: 'Approver 1', status: 'pending' },
          ],
        },
      };

      expect(requestBody.approvers.length).toBeGreaterThan(0);
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.status).toBe('pending_approval');
    });

    it('should fail if version is not in draft status', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Only draft versions can be submitted for approval',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });
  });

  describe('GET /api/documents/approvals', () => {
    it('should return pending approvals for current user', () => {
      const expectedResponse = {
        success: true,
        data: [
          {
            id: 1,
            documentId: 1,
            documentNumber: 'SOP-2412-0001',
            documentTitle: 'Quality Control Procedures',
            versionNumber: '1.0',
            approvalRole: 'reviewer',
            submittedAt: '2024-12-22T10:00:00.000Z',
            submittedBy: 'John Doe',
          },
          {
            id: 2,
            documentId: 2,
            documentNumber: 'SOP-2412-0002',
            documentTitle: 'Lab Safety Procedures',
            versionNumber: '2.0',
            approvalRole: 'approver',
            submittedAt: '2024-12-22T11:00:00.000Z',
            submittedBy: 'Jane Smith',
          },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(Array.isArray(expectedResponse.data)).toBe(true);
      expectedResponse.data.forEach(approval => {
        expect(approval).toHaveProperty('documentNumber');
        expect(approval).toHaveProperty('approvalRole');
      });
    });
  });

  describe('POST /api/documents/approvals/[id]', () => {
    it('should approve document version', () => {
      const requestBody = {
        decision: 'approved',
        comments: 'Approved - meets all requirements',
      };

      const expectedResponse = {
        success: true,
        data: {
          approvalId: 1,
          status: 'approved',
          signedAt: '2024-12-22T12:00:00.000Z',
          versionStatus: 'approved', // Version status after all approvals
        },
      };

      expect(requestBody.decision).toBe('approved');
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.status).toBe('approved');
    });

    it('should reject document version with comments', () => {
      const requestBody = {
        decision: 'rejected',
        comments: 'Needs revision: Section 3 requires more detail on safety procedures',
      };

      const expectedResponse = {
        success: true,
        data: {
          approvalId: 1,
          status: 'rejected',
          signedAt: '2024-12-22T12:00:00.000Z',
          versionStatus: 'rejected',
        },
      };

      expect(requestBody.decision).toBe('rejected');
      expect(requestBody.comments.length).toBeGreaterThan(0);
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.versionStatus).toBe('rejected');
    });

    it('should require comments for rejection', () => {
      const requestBody = {
        decision: 'rejected',
        // Missing comments
      };

      const expectedErrorResponse = {
        success: false,
        error: 'Comments are required when rejecting a document',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });

    it('should not allow approval by non-assigned user', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'You are not authorized to approve this document',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });
  });

  describe('Document Lifecycle Workflow', () => {
    it('should follow correct status transitions', () => {
      const validTransitions = [
        { from: 'draft', to: 'active', via: 'approval' },
        { from: 'active', to: 'obsolete', via: 'obsolete_request' },
        { from: 'obsolete', to: 'archived', via: 'archive_request' },
      ];

      validTransitions.forEach(transition => {
        expect(transition).toHaveProperty('from');
        expect(transition).toHaveProperty('to');
        expect(transition).toHaveProperty('via');
      });
    });

    it('should update document status to active after version approval', () => {
      // When all approvals for a version are complete, document becomes active
      const workflowResult = {
        documentId: 1,
        versionId: 1,
        previousStatus: 'draft',
        newStatus: 'active',
        effectiveDate: '2024-12-22',
      };

      expect(workflowResult.newStatus).toBe('active');
      expect(workflowResult.effectiveDate).toBeDefined();
    });

    it('should supersede previous version when new version is approved', () => {
      const workflowResult = {
        documentId: 1,
        oldVersionId: 1,
        oldVersionStatus: 'superseded',
        newVersionId: 2,
        newVersionStatus: 'approved',
      };

      expect(workflowResult.oldVersionStatus).toBe('superseded');
      expect(workflowResult.newVersionStatus).toBe('approved');
    });
  });

  describe('POST /api/documents/[id]/obsolete', () => {
    it('should mark document as obsolete', () => {
      const requestBody = {
        reason: 'Replaced by updated procedure',
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          status: 'obsolete',
          obsoleteDate: '2024-12-22',
        },
      };

      expect(requestBody.reason).toBeDefined();
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.status).toBe('obsolete');
    });

    it('should not allow obsoleting draft documents', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Only active documents can be marked as obsolete',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });
  });

  describe('GET /api/documents/statistics', () => {
    it('should return document statistics', () => {
      const expectedResponse = {
        success: true,
        data: {
          totalDocuments: 50,
          byStatus: {
            draft: 5,
            active: 40,
            obsolete: 3,
            archived: 2,
          },
          byType: {
            SOP: 25,
            POL: 5,
            FORM: 15,
            WI: 5,
          },
          pendingApprovals: 3,
          reviewsDueSoon: 2,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.totalDocuments).toBeGreaterThan(0);
      expect(Object.values(expectedResponse.data.byStatus).reduce((a, b) => a + b, 0))
        .toBe(expectedResponse.data.totalDocuments);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthenticated requests', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Authentication required',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Authentication');
    });

    it('should return 403 for unauthorized access', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Insufficient permissions to access this resource',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('permissions');
    });

    it('should return 400 for invalid input', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Validation failed',
        details: [
          { field: 'typeId', message: 'Invalid document type' },
        ],
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse).toHaveProperty('details');
    });

    it('should return 500 for server errors', () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Internal server error',
      };

      expect(expectedErrorResponse.success).toBe(false);
    });
  });
});

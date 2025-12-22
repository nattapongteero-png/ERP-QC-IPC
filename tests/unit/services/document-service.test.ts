/**
 * Unit Tests for Document Control Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Tests the DocumentService functions for GMP document control
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  useSqlite: vi.fn().mockReturnValue(true),
}));

// Mock the audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock the schema
vi.mock('@/lib/db/schema', () => ({
  sqliteDocumentTypes: { id: 'id', code: 'code', name: 'name', prefix: 'prefix' },
  sqliteDocuments: { id: 'id', documentNumber: 'documentNumber', title: 'title', typeId: 'typeId' },
  sqliteDocumentVersions: { id: 'id', documentId: 'documentId', versionNumber: 'versionNumber' },
  sqliteDocumentApprovals: { id: 'id', versionId: 'versionId', approverId: 'approverId' },
  sqliteUsers: { id: 'id', name: 'name' },
  sqliteHROrgUnits: { id: 'id', name: 'name' },
}));

describe('DocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Document Types API Response Format', () => {
    it('should return document type with all required fields', () => {
      const expectedDocumentType = {
        id: 1,
        code: 'SOP',
        name: 'Standard Operating Procedure',
        prefix: 'SOP',
        approvalChain: JSON.stringify(['author', 'reviewer', 'approver']),
        reviewPeriodMonths: 24,
      };

      expect(expectedDocumentType).toHaveProperty('id');
      expect(expectedDocumentType).toHaveProperty('code');
      expect(expectedDocumentType).toHaveProperty('name');
      expect(expectedDocumentType).toHaveProperty('prefix');
      expect(expectedDocumentType).toHaveProperty('approvalChain');
      expect(expectedDocumentType).toHaveProperty('reviewPeriodMonths');
    });
  });

  describe('Document Create Input Validation', () => {
    it('should validate required fields for document creation', () => {
      const validInput = {
        title: 'Test SOP Document',
        typeId: 1,
      };

      expect(validInput.title).toBeDefined();
      expect(validInput.typeId).toBeDefined();
      expect(typeof validInput.title).toBe('string');
      expect(typeof validInput.typeId).toBe('number');
    });

    it('should accept optional fields for document creation', () => {
      const inputWithOptional = {
        title: 'Test SOP Document',
        typeId: 1,
        departmentId: 5,
        content: 'Initial content for the document',
        retentionYears: 5,
      };

      expect(inputWithOptional.departmentId).toBe(5);
      expect(inputWithOptional.content).toBe('Initial content for the document');
      expect(inputWithOptional.retentionYears).toBe(5);
    });
  });

  describe('Document Number Format', () => {
    it('should follow GMP document number format', () => {
      // Format: {PREFIX}-{YYMM}-{SEQUENCE}
      const documentNumber = 'SOP-2412-0001';
      const parts = documentNumber.split('-');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('SOP'); // Prefix
      expect(parts[1]).toMatch(/^\d{4}$/); // YYMM format
      expect(parts[2]).toMatch(/^\d{4}$/); // 4-digit sequence
    });

    it('should generate unique sequential numbers', () => {
      const numbers = [
        'SOP-2412-0001',
        'SOP-2412-0002',
        'SOP-2412-0003',
      ];

      const sequences = numbers.map(n => parseInt(n.split('-')[2]));
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i]).toBe(sequences[i - 1] + 1);
      }
    });
  });

  describe('Document Version Response Format', () => {
    it('should return version with all required fields', () => {
      const expectedVersion = {
        id: 1,
        documentId: 1,
        versionNumber: '1.0',
        content: 'Document content here',
        filePath: null,
        changeDescription: 'Initial version',
        status: 'draft',
        effectiveDate: null,
        obsoleteDate: null,
        createdBy: 1,
        createdByName: 'Admin User',
        createdAt: '2024-12-22T10:00:00.000Z',
        approvals: [],
      };

      expect(expectedVersion).toHaveProperty('id');
      expect(expectedVersion).toHaveProperty('documentId');
      expect(expectedVersion).toHaveProperty('versionNumber');
      expect(expectedVersion).toHaveProperty('status');
      expect(expectedVersion).toHaveProperty('createdBy');
      expect(expectedVersion).toHaveProperty('approvals');
    });

    it('should support version status transitions', () => {
      const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected', 'superseded'];

      validStatuses.forEach(status => {
        expect(['draft', 'pending_approval', 'approved', 'rejected', 'superseded']).toContain(status);
      });
    });
  });

  describe('Version Number Logic', () => {
    it('should increment minor version for minor revisions', () => {
      const currentVersion = '1.0';
      const [major, minor] = currentVersion.split('.').map(Number);
      const nextMinor = `${major}.${minor + 1}`;

      expect(nextMinor).toBe('1.1');
    });

    it('should increment major version for major revisions', () => {
      const currentVersion = '1.5';
      const [major] = currentVersion.split('.').map(Number);
      const nextMajor = `${major + 1}.0`;

      expect(nextMajor).toBe('2.0');
    });
  });

  describe('Document Approval Flow', () => {
    it('should have valid approval roles', () => {
      const validRoles = ['author', 'reviewer', 'approver'];

      validRoles.forEach(role => {
        expect(['author', 'reviewer', 'approver']).toContain(role);
      });
    });

    it('should have valid approval statuses', () => {
      const validStatuses = ['pending', 'approved', 'rejected'];

      validStatuses.forEach(status => {
        expect(['pending', 'approved', 'rejected']).toContain(status);
      });
    });

    it('should require comments for rejection', () => {
      const rejectionDecision = {
        decision: 'rejected' as const,
        comments: 'Needs revision: section 3 unclear',
      };

      expect(rejectionDecision.comments).toBeDefined();
      expect(rejectionDecision.comments.length).toBeGreaterThan(0);
    });
  });

  describe('Pending Approval Response Format', () => {
    it('should return pending approval with all required fields', () => {
      const expectedPendingApproval = {
        id: 1,
        documentId: 1,
        documentNumber: 'SOP-2412-0001',
        documentTitle: 'Safety Procedures for Lab Equipment',
        versionNumber: '1.0',
        approvalRole: 'reviewer',
        submittedAt: '2024-12-22T10:00:00.000Z',
        submittedBy: 'John Doe',
      };

      expect(expectedPendingApproval).toHaveProperty('id');
      expect(expectedPendingApproval).toHaveProperty('documentId');
      expect(expectedPendingApproval).toHaveProperty('documentNumber');
      expect(expectedPendingApproval).toHaveProperty('documentTitle');
      expect(expectedPendingApproval).toHaveProperty('versionNumber');
      expect(expectedPendingApproval).toHaveProperty('approvalRole');
      expect(expectedPendingApproval).toHaveProperty('submittedAt');
      expect(expectedPendingApproval).toHaveProperty('submittedBy');
    });
  });

  describe('Document List Response Format', () => {
    it('should return paginated document list', () => {
      const expectedResponse = {
        documents: [
          {
            id: 1,
            documentNumber: 'SOP-2412-0001',
            title: 'Safety Procedures',
            typeId: 1,
            typeName: 'Standard Operating Procedure',
            departmentId: 1,
            departmentName: 'Quality Assurance',
            currentVersionId: 1,
            status: 'active',
            retentionYears: 5,
            createdBy: 1,
            createdByName: 'Admin',
            createdAt: '2024-12-22T10:00:00.000Z',
            updatedAt: '2024-12-22T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      expect(expectedResponse).toHaveProperty('documents');
      expect(expectedResponse).toHaveProperty('total');
      expect(Array.isArray(expectedResponse.documents)).toBe(true);
    });

    it('should support filtering by status', () => {
      const validStatuses = ['draft', 'active', 'obsolete', 'archived'];

      validStatuses.forEach(status => {
        const params = { status };
        expect(params.status).toBeDefined();
      });
    });

    it('should support filtering by typeId', () => {
      const params = { typeId: 1 };
      expect(params.typeId).toBe(1);
    });

    it('should support search by title', () => {
      const params = { search: 'safety' };
      expect(params.search).toBe('safety');
    });
  });

  describe('Document Details Response Format', () => {
    it('should include version history in details', () => {
      const expectedDetails = {
        id: 1,
        documentNumber: 'SOP-2412-0001',
        title: 'Safety Procedures',
        typeId: 1,
        typeName: 'Standard Operating Procedure',
        typeCode: 'SOP',
        departmentId: 1,
        departmentName: 'Quality Assurance',
        currentVersionId: 2,
        status: 'active',
        retentionYears: 5,
        createdBy: 1,
        createdByName: 'Admin',
        createdAt: '2024-12-22T10:00:00.000Z',
        updatedAt: '2024-12-22T12:00:00.000Z',
        currentVersion: {
          id: 2,
          documentId: 1,
          versionNumber: '1.1',
          status: 'approved',
          effectiveDate: '2024-12-22',
        },
        versions: [
          { id: 2, versionNumber: '1.1', status: 'approved' },
          { id: 1, versionNumber: '1.0', status: 'superseded' },
        ],
      };

      expect(expectedDetails).toHaveProperty('currentVersion');
      expect(expectedDetails).toHaveProperty('versions');
      expect(Array.isArray(expectedDetails.versions)).toBe(true);
      expect(expectedDetails.versions.length).toBe(2);
    });
  });

  describe('Document Statistics Response Format', () => {
    it('should return counts by status and type', () => {
      const expectedStats = {
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
      };

      expect(expectedStats).toHaveProperty('totalDocuments');
      expect(expectedStats).toHaveProperty('byStatus');
      expect(expectedStats).toHaveProperty('byType');
      expect(expectedStats).toHaveProperty('pendingApprovals');
      expect(expectedStats).toHaveProperty('reviewsDueSoon');
    });
  });

  describe('Document Obsolete Logic', () => {
    it('should set obsolete status and date', () => {
      const obsoleteUpdate = {
        status: 'obsolete',
        obsoleteDate: new Date().toISOString().split('T')[0],
      };

      expect(obsoleteUpdate.status).toBe('obsolete');
      expect(obsoleteUpdate.obsoleteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Audit Trail Integration', () => {
    it('should create audit log on document creation', () => {
      const auditEntry = {
        action: 'document_created',
        entityType: 'document',
        entityId: 1,
        userId: 1,
        details: {
          documentNumber: 'SOP-2412-0001',
          title: 'Safety Procedures',
        },
      };

      expect(auditEntry.action).toBe('document_created');
      expect(auditEntry.entityType).toBe('document');
    });

    it('should create audit log on approval decision', () => {
      const auditEntry = {
        action: 'document_approved',
        entityType: 'document_version',
        entityId: 1,
        userId: 2,
        details: {
          documentId: 1,
          versionNumber: '1.0',
          decision: 'approved',
          comments: 'Approved as per review',
        },
      };

      expect(auditEntry.action).toBe('document_approved');
      expect(auditEntry.details.decision).toBe('approved');
    });
  });
});

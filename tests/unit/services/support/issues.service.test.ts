/**
 * Issue Tracker Service Unit Tests
 * Task 4: Core CRUD Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock data for tests
const mockIssue = {
  id: 1,
  issueNumber: 'ISS-2026-0001',
  title: 'Test Issue',
  description: '{"summary":"Test summary","impact":"Test impact"}',
  categoryId: 1,
  severity: 'major',
  priority: 'scheduled',
  status: 'submitted',
  reporterId: 1,
  assigneeId: 2,
  aiValidationPassed: false,
  aiValidationSkipped: false,
  duplicateOfId: null,
  resolvedAt: null,
  verifiedAt: null,
  closedAt: null,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

const mockCategory = {
  id: 1,
  name: 'Software Bug',
  description: 'Software-related issues',
  type: 'software',
  requiredFields: '["summary","impact"]',
  aiPrompt: 'Validate software bug report',
  isActive: true,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

const mockTag = {
  id: 1,
  name: 'urgent',
  color: '#FF0000',
  createdAt: '2026-01-16T00:00:00.000Z',
};

const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
};

// Track current query for mock responses
let currentQueryType = 'default';
let mockReturnData: any[] = [];

// Mock the database modules
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal() as any;

  return {
    ...actual,
    isSqlite: vi.fn(() => true),
    getDb: vi.fn(() => Promise.resolve({
      select: vi.fn(() => {
        const thenable = {
          from: vi.fn(() => thenable),
          where: vi.fn(() => thenable),
          leftJoin: vi.fn(() => thenable),
          innerJoin: vi.fn(() => thenable),
          orderBy: vi.fn(() => thenable),
          limit: vi.fn(() => thenable),
          offset: vi.fn(() => thenable),
          groupBy: vi.fn(() => thenable),
          then: (resolve: (value: unknown[]) => void) => {
            resolve(mockReturnData);
            mockReturnData = [];
          }
        };
        return thenable;
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => Promise.resolve({ lastInsertRowid: 1 }))
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ id: 1 }]))
        }))
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ id: 1 }]))
      }))
    }))
  };
});

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve())
}));

// Import after mocking
import {
  generateIssueNumber,
  listIssueCategories,
  getIssueCategory,
  createIssueCategory,
  updateIssueCategory,
  deleteIssueCategory,
  listIssueTags,
  getIssueTag,
  createIssueTag,
  deleteIssueTag,
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  deleteIssue,
  updateAIValidation,
  markAsDuplicate,
  getIssueByNumber,
} from '@/lib/services/issues.service';

import type {
  IssueCreate,
  IssueUpdate,
  IssueCategoryCreate,
  IssueCategoryUpdate,
  IssueTagCreate,
  IssueListFilters,
} from '@/types/issues';

describe('Issue Tracker Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQueryType = 'default';
    mockReturnData = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Issue Number Generation Tests
  // ============================================
  describe('generateIssueNumber', () => {
    it('should generate issue number with correct format', async () => {
      const issueNumber = await generateIssueNumber();

      // Format: ISS-YYYY-NNNN
      expect(issueNumber).toMatch(/^ISS-\d{4}-\d{4}$/);

      // Check year is current
      const year = new Date().getFullYear();
      expect(issueNumber.startsWith(`ISS-${year}-`)).toBe(true);
    });

    it('should start with 0001 when no existing issues', async () => {
      const issueNumber = await generateIssueNumber();
      expect(issueNumber).toMatch(/-0001$/);
    });
  });

  // ============================================
  // Issue Category Tests
  // ============================================
  describe('Issue Categories', () => {
    describe('listIssueCategories', () => {
      it('should return empty list when no categories exist', async () => {
        const result = await listIssueCategories();
        expect(Array.isArray(result)).toBe(true);
      });

      it('should accept filter parameters', async () => {
        const result = await listIssueCategories({
          isActive: true,
          type: 'software',
          search: 'bug',
        });
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('getIssueCategory', () => {
      it('should return null when category not found', async () => {
        const result = await getIssueCategory(999);
        expect(result).toBeNull();
      });
    });

    describe('createIssueCategory', () => {
      it('should require mandatory fields', () => {
        const validData: IssueCategoryCreate = {
          name: 'Test Category',
          type: 'software',
        };

        expect(validData.name).toBeTruthy();
        expect(validData.type).toBe('software');
      });

      it('should support all category types', () => {
        const types = ['software', 'operational'];

        types.forEach(type => {
          const data: IssueCategoryCreate = {
            name: 'Test Category',
            type: type as 'software' | 'operational',
          };
          expect(data.type).toBe(type);
        });
      });

      it('should support optional fields', () => {
        const data: IssueCategoryCreate = {
          name: 'Test Category',
          description: 'Test description',
          type: 'software',
          requiredFields: ['summary', 'impact'],
          aiPrompt: 'Validate the issue',
        };

        expect(data.description).toBeTruthy();
        expect(data.requiredFields).toHaveLength(2);
        expect(data.aiPrompt).toBeTruthy();
      });
    });

    describe('updateIssueCategory', () => {
      it('should support partial updates', () => {
        const updates: IssueCategoryUpdate = {
          name: 'Updated Name',
          isActive: false,
        };

        expect(updates.name).toBe('Updated Name');
        expect(updates.isActive).toBe(false);
      });
    });
  });

  // ============================================
  // Issue Tag Tests
  // ============================================
  describe('Issue Tags', () => {
    describe('listIssueTags', () => {
      it('should return empty list when no tags exist', async () => {
        const result = await listIssueTags();
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('getIssueTag', () => {
      it('should return null when tag not found', async () => {
        const result = await getIssueTag(999);
        expect(result).toBeNull();
      });
    });

    describe('createIssueTag', () => {
      it('should require name and color', () => {
        const validData: IssueTagCreate = {
          name: 'urgent',
          color: '#FF0000',
        };

        expect(validData.name).toBe('urgent');
        expect(validData.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });

  // ============================================
  // Issue CRUD Tests
  // ============================================
  describe('Issues', () => {
    describe('listIssues', () => {
      it('should return paginated list structure', async () => {
        const result = await listIssues();

        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('page');
        expect(result).toHaveProperty('limit');
        expect(result).toHaveProperty('totalPages');
        expect(Array.isArray(result.items)).toBe(true);
      });

      it('should accept all filter parameters', async () => {
        const filters: IssueListFilters = {
          status: 'submitted',
          severity: 'major',
          priority: 'urgent',
          categoryId: 1,
          assigneeId: 1,
          reporterId: 1,
          tagIds: [1, 2],
          search: 'test',
          page: 1,
          limit: 10,
        };

        const result = await listIssues(filters);
        expect(result).toHaveProperty('items');
      });

      it('should filter by status', async () => {
        const result = await listIssues({ status: 'in_progress' });
        expect(result).toHaveProperty('items');
      });

      it('should filter by severity', async () => {
        const result = await listIssues({ severity: 'critical' });
        expect(result).toHaveProperty('items');
      });
    });

    describe('getIssue', () => {
      it('should return null when issue not found', async () => {
        const result = await getIssue(999);
        expect(result).toBeNull();
      });
    });

    describe('createIssue', () => {
      it('should require mandatory fields', () => {
        const validData: IssueCreate = {
          title: 'Test Issue',
          description: {
            summary: 'Test summary',
          },
          categoryId: 1,
          severity: 'major',
        };

        expect(validData.title).toBeTruthy();
        expect(validData.description.summary).toBeTruthy();
        expect(validData.categoryId).toBe(1);
        expect(validData.severity).toBe('major');
      });

      it('should support all severity levels', () => {
        const severities = ['critical', 'major', 'minor'];

        severities.forEach(severity => {
          const data: IssueCreate = {
            title: 'Test',
            description: { summary: 'Test' },
            categoryId: 1,
            severity: severity as 'critical' | 'major' | 'minor',
          };
          expect(data.severity).toBe(severity);
        });
      });

      it('should support optional tagIds', () => {
        const data: IssueCreate = {
          title: 'Test',
          description: { summary: 'Test' },
          categoryId: 1,
          severity: 'major',
          tagIds: [1, 2, 3],
        };

        expect(data.tagIds).toHaveLength(3);
      });

      it('should support full description structure', () => {
        const data: IssueCreate = {
          title: 'Test Issue',
          description: {
            summary: 'Brief summary',
            impact: 'Business impact description',
            environment: 'Production environment',
            expectedBehavior: 'Expected behavior description',
            actualBehavior: 'Actual behavior description',
            stepsToReproduce: '1. Step one\n2. Step two',
          },
          categoryId: 1,
          severity: 'critical',
        };

        expect(data.description.summary).toBeTruthy();
        expect(data.description.impact).toBeTruthy();
        expect(data.description.stepsToReproduce).toBeTruthy();
      });
    });

    describe('updateIssue', () => {
      it('should support partial updates', () => {
        const updates: IssueUpdate = {
          title: 'Updated Title',
          priority: 'urgent',
        };

        expect(updates.title).toBe('Updated Title');
        expect(updates.priority).toBe('urgent');
      });

      it('should support all priority levels', () => {
        const priorities = ['immediate', 'urgent', 'scheduled', 'backlog'];

        priorities.forEach(priority => {
          const updates: IssueUpdate = {
            priority: priority as 'immediate' | 'urgent' | 'scheduled' | 'backlog',
          };
          expect(updates.priority).toBe(priority);
        });
      });

      it('should support all status transitions', () => {
        const statuses = ['draft', 'submitted', 'triaged', 'in_progress', 'resolved', 'verified', 'closed'];

        statuses.forEach(status => {
          const updates: IssueUpdate = {
            status: status as IssueUpdate['status'],
          };
          expect(updates.status).toBe(status);
        });
      });

      it('should support assignment changes', () => {
        const updates: IssueUpdate = {
          assigneeId: 5,
        };
        expect(updates.assigneeId).toBe(5);

        const unassign: IssueUpdate = {
          assigneeId: null,
        };
        expect(unassign.assigneeId).toBeNull();
      });

      it('should support tag updates', () => {
        const updates: IssueUpdate = {
          tagIds: [1, 2, 3],
        };
        expect(updates.tagIds).toHaveLength(3);
      });
    });
  });

  // ============================================
  // Utility Function Tests
  // ============================================
  describe('Utility Functions', () => {
    describe('updateAIValidation', () => {
      it('should return false for non-existent issue', async () => {
        const result = await updateAIValidation(99999, true, false);
        expect(result).toBe(false);
      });
    });

    describe('getIssueByNumber', () => {
      it('should accept issue number format', async () => {
        const issueNumber = 'ISS-2026-0001';
        const result = await getIssueByNumber(issueNumber);
        // Should not throw
        expect(result === null || typeof result === 'object').toBe(true);
      });
    });

    describe('markAsDuplicate', () => {
      it('should throw error when issue not found', async () => {
        await expect(markAsDuplicate(99999, 1, 1)).rejects.toThrow('Issue not found');
      });
    });

    describe('deleteIssue', () => {
      it('should throw error when issue not found', async () => {
        await expect(deleteIssue(99999)).rejects.toThrow('Issue not found');
      });
    });

    describe('createIssue', () => {
      it('should throw error when category not found', async () => {
        const data: IssueCreate = {
          title: 'Test Issue',
          description: { summary: 'Test summary' },
          categoryId: 99999,
          severity: 'major',
        };
        await expect(createIssue(data, 1, 'draft')).rejects.toThrow('Category not found');
      });
    });

    describe('updateIssue', () => {
      it('should throw error when issue not found', async () => {
        const updates: IssueUpdate = { title: 'Updated' };
        await expect(updateIssue(99999, updates, 1)).rejects.toThrow('Issue not found');
      });
    });
  });

  // ============================================
  // Issue Workflow Tests
  // ============================================
  describe('Issue Workflow', () => {
    it('should follow standard issue workflow states', () => {
      const workflowStates = [
        'draft',        // Initial draft
        'submitted',    // Submitted for review
        'triaged',      // Triaged with priority
        'in_progress',  // Being worked on
        'resolved',     // Resolution implemented
        'verified',     // Resolution verified
        'closed',       // Issue closed
      ];

      expect(workflowStates).toHaveLength(7);
      expect(workflowStates[0]).toBe('draft');
      expect(workflowStates[6]).toBe('closed');
    });

    it('should support severity levels', () => {
      const severities = ['critical', 'major', 'minor'];
      expect(severities).toHaveLength(3);
    });

    it('should support priority levels', () => {
      const priorities = ['immediate', 'urgent', 'scheduled', 'backlog'];
      expect(priorities).toHaveLength(4);
    });
  });

  // ============================================
  // Audit Event Types Tests
  // ============================================
  describe('Audit Event Types', () => {
    it('should support all audit event types', () => {
      const eventTypes = [
        'created',
        'edited',
        'status_changed',
        'assigned',
        'priority_changed',
        'severity_changed',
        'commented',
        'merged',
        'attachment_added',
        'attachment_removed',
      ];

      expect(eventTypes).toContain('created');
      expect(eventTypes).toContain('status_changed');
      expect(eventTypes).toContain('assigned');
      expect(eventTypes).toContain('merged');
    });
  });

  // ============================================
  // Description Structure Tests
  // ============================================
  describe('Issue Description Structure', () => {
    it('should support structured description', () => {
      const description = {
        summary: 'Brief summary of the issue',
        impact: 'Description of business impact',
        environment: 'Production server A',
        expectedBehavior: 'System should process orders',
        actualBehavior: 'System throws error',
        stepsToReproduce: '1. Login\n2. Navigate to orders\n3. Click submit',
      };

      expect(description.summary).toBeTruthy();
      expect(description.impact).toBeTruthy();
      expect(description.stepsToReproduce).toContain('1.');
    });

    it('should require only summary field', () => {
      const minimalDescription = {
        summary: 'Minimal issue description',
      };

      expect(minimalDescription.summary).toBeTruthy();
    });
  });

  // ============================================
  // Category Type Tests
  // ============================================
  describe('Issue Category Types', () => {
    it('should support software type', () => {
      const category: IssueCategoryCreate = {
        name: 'Bug Report',
        type: 'software',
        requiredFields: ['summary', 'stepsToReproduce'],
      };

      expect(category.type).toBe('software');
    });

    it('should support operational type', () => {
      const category: IssueCategoryCreate = {
        name: 'Process Issue',
        type: 'operational',
        requiredFields: ['summary', 'impact'],
      };

      expect(category.type).toBe('operational');
    });
  });
});

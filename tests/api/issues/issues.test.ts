/**
 * Issues API Route Tests
 * Feature: Issue Tracker
 *
 * Tests for /api/issues endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

// Mock issues service
vi.mock('@/lib/services/issues.service', () => ({
  listIssues: vi.fn(),
  createIssue: vi.fn(),
  getIssueById: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
}));

import { getSession, hasPermission } from '@/lib/auth';
import { listIssues, createIssue } from '@/lib/services/issues.service';
import { GET, POST } from '@/app/api/issues/route';

const mockSession = {
  userId: 1,
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin User',
};

describe('Issues API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/issues', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 when user lacks permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Permission denied');
    });

    it('should return list of issues successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(listIssues).mockResolvedValue({
        items: [
          {
            id: 1,
            issueNumber: 'ISS-0001',
            title: 'Test Issue',
            status: 'submitted',
            severity: 'major',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as ReturnType<typeof listIssues> extends Promise<infer T> ? T : never);

      const request = new NextRequest('http://localhost/api/issues');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].issueNumber).toBe('ISS-0001');
    });

    it('should apply filters from query parameters', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(listIssues).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      } as ReturnType<typeof listIssues> extends Promise<infer T> ? T : never);

      const request = new NextRequest(
        'http://localhost/api/issues?status=submitted&severity=critical&page=1&limit=10'
      );
      await GET(request);

      expect(listIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'submitted',
          severity: 'critical',
          page: 1,
          limit: 10,
        })
      );
    });

    it('should apply search filter', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(listIssues).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as ReturnType<typeof listIssues> extends Promise<infer T> ? T : never);

      const request = new NextRequest('http://localhost/api/issues?search=login%20bug');
      await GET(request);

      expect(listIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'login bug',
        })
      );
    });

    it('should apply categoryId and assigneeId filters', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(listIssues).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as ReturnType<typeof listIssues> extends Promise<infer T> ? T : never);

      const request = new NextRequest(
        'http://localhost/api/issues?categoryId=5&assigneeId=10'
      );
      await GET(request);

      expect(listIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 5,
          assigneeId: 10,
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(listIssues).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/issues');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to list issues');
    });
  });

  describe('POST /api/issues', () => {
    const validIssueData = {
      title: 'Test Issue Title',
      description: {
        summary: 'This is a test issue summary with enough detail.',
        impact: 'Affects production users',
      },
      categoryId: 1,
      severity: 'major',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues', {
        method: 'POST',
        body: JSON.stringify(validIssueData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks write permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues', {
        method: 'POST',
        body: JSON.stringify(validIssueData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid request body', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const invalidData = {
        title: '', // Title too short
        description: {},
      };

      const request = new NextRequest('http://localhost/api/issues', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('should create issue successfully with valid data', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(createIssue).mockResolvedValue({
        id: 1,
        issueNumber: 'ISS-0001',
        title: validIssueData.title,
        description: validIssueData.description,
        categoryId: 1,
        status: 'draft',
        severity: 'major',
        priority: null,
        reporterId: 1,
        assigneeId: null,
        aiValidationPassed: null,
        resolutionNotes: null,
        closedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        reporter: null,
        assignee: null,
        tags: [],
      } as unknown as Awaited<ReturnType<typeof createIssue>>);

      const request = new NextRequest('http://localhost/api/issues', {
        method: 'POST',
        body: JSON.stringify(validIssueData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.issueNumber).toBe('ISS-0001');
      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: validIssueData.title,
          severity: 'major',
        }),
        mockSession.userId,
        'draft'
      );
    });

    it('should handle service errors', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(createIssue).mockRejectedValue(new Error('Database constraint error'));

      const request = new NextRequest('http://localhost/api/issues', {
        method: 'POST',
        body: JSON.stringify(validIssueData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database constraint error');
    });
  });
});

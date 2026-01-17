/**
 * Issue Comments API Route Tests
 * Feature: Issue Tracker
 *
 * Tests for /api/issues/:id/comments endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

// Mock comments service
vi.mock('@/lib/services/issues-comments.service', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

// Mock issues service (needed for issue existence check)
vi.mock('@/lib/services/issues.service', () => ({
  getIssue: vi.fn(),
}));

import { getSession, hasPermission } from '@/lib/auth';
import { listComments, createComment } from '@/lib/services/issues-comments.service';
import { getIssue } from '@/lib/services/issues.service';
import { GET, POST } from '@/app/api/issues/[id]/comments/route';
import type { IssueComment, Issue } from '@/types/issues';

const mockIssue: Partial<Issue> = {
  id: 1,
  issueNumber: 'ISS-0001',
  title: 'Test Issue',
  description: { summary: 'Test summary' },
  categoryId: 1,
  status: 'submitted',
  severity: 'major',
  priority: 'scheduled',
  reporterId: 1,
  assigneeId: null,
  aiValidationPassed: true,
  aiValidationSkipped: false,
  duplicateOfId: null,
  resolvedAt: null,
  verifiedAt: null,
  closedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSession = {
  userId: 1,
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin User',
};

const mockComment: Partial<IssueComment> = {
  id: 1,
  issueId: 1,
  content: 'Test comment content',
  authorId: 1,
  mentionedUserIds: [],
  isEdited: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Issue Comments API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/issues/:id/comments', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/1/comments');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/1/comments');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid issue ID', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/issues/invalid/comments');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return comments successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssue).mockResolvedValue(mockIssue as Issue);
      vi.mocked(listComments).mockResolvedValue([mockComment as IssueComment]);

      const request = new NextRequest('http://localhost/api/issues/1/comments');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].content).toBe('Test comment content');
    });

    it('should handle service errors', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssue).mockResolvedValue(mockIssue as Issue);
      vi.mocked(listComments).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/issues/1/comments');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/issues/:id/comments', () => {
    const newCommentData = {
      content: 'This is a new comment',
      isInternal: false,
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/1/comments', {
        method: 'POST',
        body: JSON.stringify(newCommentData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks write permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/1/comments', {
        method: 'POST',
        body: JSON.stringify(newCommentData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid issue ID', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/issues/invalid/comments', {
        method: 'POST',
        body: JSON.stringify(newCommentData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid comment data', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const invalidData = {
        content: '', // Empty content
      };

      const request = new NextRequest('http://localhost/api/issues/1/comments', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should create comment successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(createComment).mockResolvedValue({
        id: 2,
        issueId: 1,
        content: newCommentData.content,
        authorId: mockSession.userId,
        mentionedUserIds: [],
        isEdited: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as IssueComment);

      const request = new NextRequest('http://localhost/api/issues/1/comments', {
        method: 'POST',
        body: JSON.stringify(newCommentData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.content).toBe(newCommentData.content);
      expect(createComment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          content: newCommentData.content,
        }),
        mockSession.userId
      );
    });

    it('should handle service errors', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(createComment).mockRejectedValue(new Error('Issue not found'));

      const request = new NextRequest('http://localhost/api/issues/1/comments', {
        method: 'POST',
        body: JSON.stringify(newCommentData),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});

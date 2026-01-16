/**
 * Issue Detail API Route Tests
 * Feature: Issue Tracker
 *
 * Tests for /api/issues/:id endpoints
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
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
}));

import { getSession, hasPermission } from '@/lib/auth';
import { getIssue, updateIssue, deleteIssue } from '@/lib/services/issues.service';
import { GET, PUT, DELETE } from '@/app/api/issues/[id]/route';
import type { Issue } from '@/types/issues';

const mockSession = {
  userId: 1,
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin User',
};

const mockIssue: Partial<Issue> = {
  id: 1,
  issueNumber: 'ISS-0001',
  title: 'Test Issue',
  description: {
    summary: 'Test summary',
    impact: 'Low impact',
  },
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

describe('Issue Detail API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/issues/:id', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks read permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid issue ID', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/issues/invalid');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid issue ID');
    });

    it('should return 404 when issue not found', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssue).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/999');
      const response = await GET(request, { params: Promise.resolve({ id: '999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Issue not found');
    });

    it('should return issue details successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssue).mockResolvedValue(mockIssue as Issue);

      const request = new NextRequest('http://localhost/api/issues/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.issueNumber).toBe('ISS-0001');
      expect(data.data.title).toBe('Test Issue');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssue).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/issues/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch issue');
    });
  });

  describe('PUT /api/issues/:id', () => {
    const updateData = {
      title: 'Updated Issue Title',
      status: 'in_progress',
      priority: 'urgent',
    };

    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks write permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid issue ID', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/issues/invalid', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid update data', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const invalidData = {
        status: 'invalid_status', // Invalid status value
      };

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'PUT',
        body: JSON.stringify(invalidData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('should update issue successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(updateIssue).mockResolvedValue({
        ...mockIssue,
        title: 'Updated Issue Title',
        status: 'in_progress',
        priority: 'urgent',
      } as Issue);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated Issue Title');
      expect(updateIssue).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: 'Updated Issue Title',
          status: 'in_progress',
          priority: 'urgent',
        }),
        mockSession.userId
      );
    });

    it('should handle service errors', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(updateIssue).mockRejectedValue(new Error('Issue not found'));

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Issue not found');
    });
  });

  describe('DELETE /api/issues/:id', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 403 when user lacks delete permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Permission denied - Admin only');
    });

    it('should return 400 for invalid issue ID', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/issues/invalid', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should delete issue successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(deleteIssue).mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Issue deleted successfully');
      expect(deleteIssue).toHaveBeenCalledWith(1);
    });

    it('should handle service errors', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(deleteIssue).mockRejectedValue(new Error('Cannot delete issue with comments'));

      const request = new NextRequest('http://localhost/api/issues/1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Cannot delete issue with comments');
    });
  });
});

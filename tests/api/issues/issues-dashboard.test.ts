/**
 * Issue Dashboard API Route Tests
 * Feature: Issue Tracker
 *
 * Tests for /api/issues/dashboard endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

// Mock dashboard service
vi.mock('@/lib/services/issues-dashboard.service', () => ({
  getIssueDashboardMetrics: vi.fn(),
}));

import { getSession, hasPermission } from '@/lib/auth';
import { getIssueDashboardMetrics } from '@/lib/services/issues-dashboard.service';
import { GET } from '@/app/api/issues/dashboard/route';
import type { IssueDashboardMetrics } from '@/types/issues';

const mockSession = {
  userId: 1,
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin User',
};

const mockMetrics: IssueDashboardMetrics = {
  totalIssues: 50,
  openIssues: 20,
  resolvedIssues: 15,
  closedIssues: 10,
  issuesCreatedThisWeek: 8,
  issuesResolvedThisWeek: 5,
  avgResolutionTime: 72, // hours
  issuesByStatus: [
    { status: 'submitted', count: 5 },
    { status: 'in_progress', count: 10 },
    { status: 'resolved', count: 5 },
  ],
  issuesBySeverity: [
    { severity: 'critical', count: 3 },
    { severity: 'major', count: 10 },
    { severity: 'minor', count: 7 },
  ],
  issuesByCategory: [
    { categoryId: 1, categoryName: 'Software Bug', count: 12 },
    { categoryId: 2, categoryName: 'Feature Request', count: 8 },
  ],
  issuesByPriority: [
    { priority: 'immediate', count: 2 },
    { priority: 'urgent', count: 5 },
    { priority: 'scheduled', count: 10 },
    { priority: 'backlog', count: 3 },
  ],
  recentIssues: [],
  monthlyTrend: [
    { month: '2025-01', created: 10, resolved: 8 },
    { month: '2025-02', created: 12, resolved: 10 },
  ],
};

describe('Issue Dashboard API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/issues/dashboard', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/issues/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 when user lacks permission', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/issues/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Permission denied');
    });

    it('should return dashboard metrics successfully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssueDashboardMetrics).mockResolvedValue(mockMetrics);

      const request = new NextRequest('http://localhost/api/issues/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalIssues).toBe(50);
      expect(data.data.openIssues).toBe(20);
      expect(data.data.issuesByStatus).toHaveLength(3);
      expect(data.data.issuesBySeverity).toHaveLength(3);
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(getIssueDashboardMetrics).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/issues/dashboard');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to get dashboard metrics');
    });
  });
});

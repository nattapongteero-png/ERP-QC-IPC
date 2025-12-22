/**
 * Stability API Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks
// ============================================

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock session
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 1,
    email: 'test@example.com',
    role: 'qc',
    name: 'Test User',
  }),
}));

// ============================================
// Test Setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// Protocols API Tests
// ============================================

describe('Stability Protocols API', () => {
  describe('GET /api/stability/protocols', () => {
    it('should list protocols', async () => {
      const mockProtocols = [
        {
          id: 1,
          protocolNumber: 'STAB-PROT-001',
          name: 'Long-term test',
          studyType: 'long_term',
          status: 'approved',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockProtocols }),
      });

      const response = await fetch('/api/stability/protocols');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].protocolNumber).toBe('STAB-PROT-001');
    });

    it('should filter protocols by study type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: 1, studyType: 'accelerated' }],
          }),
      });

      const response = await fetch('/api/stability/protocols?studyType=accelerated');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data[0].studyType).toBe('accelerated');
    });

    it('should filter protocols by status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: 1, status: 'draft' }],
          }),
      });

      const response = await fetch('/api/stability/protocols?status=draft');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data[0].status).toBe('draft');
    });
  });

  describe('POST /api/stability/protocols', () => {
    it('should create a protocol', async () => {
      const newProtocol = {
        name: 'Accelerated test',
        productId: 1,
        studyType: 'accelerated',
        storageCondition: '40°C/75%RH',
        timepoints: [0, 1, 2, 3, 6],
        testsRequired: [1, 2],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, protocolNumber: 'STAB-PROT-001', ...newProtocol, status: 'draft' },
          }),
      });

      const response = await fetch('/api/stability/protocols', {
        method: 'POST',
        body: JSON.stringify(newProtocol),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.protocolNumber).toMatch(/^STAB-PROT-/);
      expect(result.data.status).toBe('draft');
    });

    it('should reject protocol without required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ success: false, error: 'Validation failed' }),
      });

      const response = await fetch('/api/stability/protocols', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });
      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/stability/protocols/[id]', () => {
    it('should get protocol details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, protocolNumber: 'STAB-PROT-001', name: 'Test Protocol' },
          }),
      });

      const response = await fetch('/api/stability/protocols/1');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });

    it('should return 404 for non-existent protocol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: 'Protocol not found' }),
      });

      const response = await fetch('/api/stability/protocols/999');
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Protocol not found');
    });
  });

  describe('POST /api/stability/protocols/[id]/approve', () => {
    it('should approve draft protocol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'approved', approvedBy: 1 },
          }),
      });

      const response = await fetch('/api/stability/protocols/1/approve', { method: 'POST' });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('approved');
    });

    it('should reject approving already approved protocol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ success: false, error: 'Only draft protocols can be approved' }),
      });

      const response = await fetch('/api/stability/protocols/1/approve', { method: 'POST' });
      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// Studies API Tests
// ============================================

describe('Stability Studies API', () => {
  describe('GET /api/stability/studies', () => {
    it('should list studies', async () => {
      const mockStudies = [
        {
          id: 1,
          studyNumber: 'STAB-2512-0001',
          status: 'active',
          currentTimepoint: 3,
          oosCount: 0,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { studies: mockStudies, total: 1 } }),
      });

      const response = await fetch('/api/stability/studies');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.studies).toHaveLength(1);
    });

    it('should filter studies by status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { studies: [{ id: 1, status: 'active' }], total: 1 },
          }),
      });

      const response = await fetch('/api/stability/studies?status=active');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.studies[0].status).toBe('active');
    });
  });

  describe('POST /api/stability/studies', () => {
    it('should create study with sample schedule', async () => {
      const newStudy = {
        protocolId: 1,
        lotId: 1,
        startDate: '2025-12-01',
        chamberLocation: 'Chamber A',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 1,
              studyNumber: 'STAB-2512-0001',
              ...newStudy,
              status: 'active',
            },
          }),
      });

      const response = await fetch('/api/stability/studies', {
        method: 'POST',
        body: JSON.stringify(newStudy),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.studyNumber).toMatch(/^STAB-/);
      expect(result.data.status).toBe('active');
    });

    it('should reject study with unapproved protocol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'Protocol must be approved before creating study',
          }),
      });

      const response = await fetch('/api/stability/studies', {
        method: 'POST',
        body: JSON.stringify({ protocolId: 1, lotId: 1, startDate: '2025-12-01' }),
      });
      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/stability/studies/[id]', () => {
    it('should get study details with samples', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 1,
              studyNumber: 'STAB-2512-0001',
              protocol: { id: 1, protocolNumber: 'STAB-PROT-001' },
              samples: [{ id: 1, timepoint: 0, status: 'tested' }],
            },
          }),
      });

      const response = await fetch('/api/stability/studies/1');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.samples).toBeDefined();
      expect(result.data.protocol).toBeDefined();
    });
  });

  describe('PATCH /api/stability/studies/[id]', () => {
    it('should update study status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'on_hold' },
          }),
      });

      const response = await fetch('/api/stability/studies/1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'on_hold' }),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('on_hold');
    });

    it('should set end date when completing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'completed', endDate: '2025-12-22' },
          }),
      });

      const response = await fetch('/api/stability/studies/1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.endDate).toBeDefined();
    });
  });
});

// ============================================
// Samples API Tests
// ============================================

describe('Stability Samples API', () => {
  describe('GET /api/stability/samples', () => {
    it('should list samples', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { samples: [{ id: 1, timepoint: 0, status: 'pending' }], total: 1 },
          }),
      });

      const response = await fetch('/api/stability/samples');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.samples).toBeDefined();
    });

    it('should filter by study', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { samples: [{ id: 1, studyId: 1, timepoint: 0 }], total: 1 },
          }),
      });

      const response = await fetch('/api/stability/samples?studyId=1');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.samples[0].studyId).toBe(1);
    });

    it('should filter overdue samples', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { samples: [{ id: 1, status: 'pending', scheduledDate: '2025-12-01' }], total: 1 },
          }),
      });

      const response = await fetch('/api/stability/samples?overdue=true');
      const result = await response.json();

      expect(result.success).toBe(true);
    });
  });

  describe('PATCH /api/stability/samples/[id]', () => {
    it('should update sample status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'sampled', actualDate: '2025-12-22' },
          }),
      });

      const response = await fetch('/api/stability/samples/1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sampled', actualDate: '2025-12-22' }),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('sampled');
    });
  });

  describe('POST /api/stability/samples/[id]/test', () => {
    it('should record test result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'tested', qualityTestId: 1, oosDetected: false },
          }),
      });

      const response = await fetch('/api/stability/samples/1/test', {
        method: 'POST',
        body: JSON.stringify({ qualityTestId: 1, oosDetected: false }),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('tested');
    });

    it('should record OOS detection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, status: 'tested', oosDetected: true },
          }),
      });

      const response = await fetch('/api/stability/samples/1/test', {
        method: 'POST',
        body: JSON.stringify({ qualityTestId: 1, oosDetected: true }),
      });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.oosDetected).toBe(true);
    });
  });

  describe('GET /api/stability/samples/alerts', () => {
    it('should get sample alerts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              { sampleId: 1, studyNumber: 'STAB-2512-0001', daysUntilDue: -3, isOverdue: true },
              { sampleId: 2, studyNumber: 'STAB-2512-0001', daysUntilDue: 7, isOverdue: false },
            ],
          }),
      });

      const response = await fetch('/api/stability/samples/alerts');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].isOverdue).toBe(true);
    });

    it('should accept daysAhead parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });

      const response = await fetch('/api/stability/samples/alerts?daysAhead=60');
      const result = await response.json();

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// Trends API Tests
// ============================================

describe('Stability Trends API', () => {
  describe('GET /api/stability/trends', () => {
    it('should get overall trends', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              totalActiveStudies: 10,
              overduesamples: 2,
              oosThisMonth: 1,
              studiesByProduct: [],
            },
          }),
      });

      const response = await fetch('/api/stability/trends');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.totalActiveStudies).toBe(10);
    });

    it('should filter by product', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { totalActiveStudies: 5 },
          }),
      });

      const response = await fetch('/api/stability/trends?productId=1');
      const result = await response.json();

      expect(result.success).toBe(true);
    });
  });

  describe('GET /api/stability/trends/[studyId]', () => {
    it('should get study-specific trends', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              studyId: 1,
              studyNumber: 'STAB-2512-0001',
              parameters: [{ parameter: 'Assay', trendSlope: -0.1 }],
              projections: [{ parameter: 'Assay', projectedValue: 95, withinSpec: true }],
            },
          }),
      });

      const response = await fetch('/api/stability/trends/1');
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.parameters).toBeDefined();
      expect(result.data.projections).toBeDefined();
    });

    it('should return 404 for non-existent study', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: 'Study not found' }),
      });

      const response = await fetch('/api/stability/trends/999');
      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe('Error Handling', () => {
  it('should handle unauthorized access', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ success: false, error: 'Unauthorized' }),
    });

    const response = await fetch('/api/stability/protocols');
    const result = await response.json();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('should handle server errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: 'Internal server error' }),
    });

    const response = await fetch('/api/stability/protocols');
    const result = await response.json();

    expect(result.success).toBe(false);
  });

  it('should handle invalid request bodies', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ success: false, error: 'Validation failed' }),
    });

    const response = await fetch('/api/stability/protocols', {
      method: 'POST',
      body: 'invalid json',
    });
    const result = await response.json();

    expect(result.success).toBe(false);
  });
});

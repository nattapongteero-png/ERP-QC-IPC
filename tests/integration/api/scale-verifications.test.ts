/**
 * Scale Verifications API Integration Tests
 * Feature: 021-scale-verification
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin' || role === 'ADMIN',
}));

const mockGetPerms = vi.fn();
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

const mockCreate = vi.fn();
const mockDashboard = vi.fn();
vi.mock('@/lib/services/scale-verification.service', () => ({
  createVerification: (input: unknown, uid: number) => mockCreate(input, uid),
  getScalesNeedingVerification: () => mockDashboard(),
}));

import { GET, POST } from '@/app/api/quality/scale-verifications/route';
import { ScaleVerificationError, SCALE_VERIFICATION_ERROR_CODES } from '@/types/scale-verification';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/quality/scale-verifications', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Scale Verifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
    mockGetPerms.mockResolvedValue(new Set(['quality:scales:verify']));
  });

  describe('GET /', () => {
    it('401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns dashboard items', async () => {
      mockDashboard.mockResolvedValue([
        { scaleId: 1, scaleCode: 'BAL-001', scaleName: 'Balance 1', status: 'active' },
      ]);
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
    });
  });

  describe('POST /', () => {
    it('401 unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const res = await POST(makeReq({}));
      expect(res.status).toBe(401);
    });

    it('403 no permission', async () => {
      mockGetPerms.mockResolvedValue(new Set());
      const res = await POST(
        makeReq({
          scaleId: 1,
          standardWeightId: 1,
          actualReading: 1000,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(403);
    });

    it('400 invalid body', async () => {
      const res = await POST(makeReq({ scaleId: 'not a number' }));
      expect(res.status).toBe(400);
    });

    it('404 scale not found', async () => {
      mockCreate.mockRejectedValue(
        new ScaleVerificationError(SCALE_VERIFICATION_ERROR_CODES.SCALE_NOT_FOUND, 'no scale'),
      );
      const res = await POST(
        makeReq({
          scaleId: 999,
          standardWeightId: 1,
          actualReading: 1000,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(404);
    });

    it('409 certificate expired', async () => {
      mockCreate.mockRejectedValue(
        new ScaleVerificationError(SCALE_VERIFICATION_ERROR_CODES.CERTIFICATE_EXPIRED, 'expired'),
      );
      const res = await POST(
        makeReq({
          scaleId: 1,
          standardWeightId: 1,
          actualReading: 1000,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('CERTIFICATE_EXPIRED');
    });

    it('409 extreme deviation', async () => {
      mockCreate.mockRejectedValue(
        new ScaleVerificationError(SCALE_VERIFICATION_ERROR_CODES.EXTREME_DEVIATION, '10x'),
      );
      const res = await POST(
        makeReq({
          scaleId: 1,
          standardWeightId: 1,
          actualReading: 100000,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('EXTREME_DEVIATION');
    });

    it('201 on success', async () => {
      mockCreate.mockResolvedValue({
        id: 1,
        scaleId: 1,
        standardWeightId: 1,
        result: 'pass',
        deviationPercent: 0.005,
        validUntil: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      });
      const res = await POST(
        makeReq({
          scaleId: 1,
          standardWeightId: 1,
          actualReading: 1000.05,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.result).toBe('pass');
    });

    it('admin bypasses permission', async () => {
      mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
      mockGetPerms.mockResolvedValue(new Set());
      mockCreate.mockResolvedValue({ id: 1, result: 'pass' });
      const res = await POST(
        makeReq({
          scaleId: 1,
          standardWeightId: 1,
          actualReading: 1000,
          signature: { password: 'pw' },
        }),
      );
      expect(res.status).toBe(201);
    });
  });
});

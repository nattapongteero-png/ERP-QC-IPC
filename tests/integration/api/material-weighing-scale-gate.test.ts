/**
 * API integration test: material-weighing endpoint enforces scale verification.
 * Feature: 021 integration
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = vi.fn();
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: async (_req: unknown, handler: (s: { userId: number; role: string }) => unknown) => {
      const s = await mockSession();
      if (!s) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      return handler(s);
    },
  };
});

const mockRecord = vi.fn();
vi.mock('@/lib/services/wo-execution.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/wo-execution.service')>();
  return {
    ...actual,
    recordMaterialWeight: (input: unknown) => mockRecord(input),
  };
});

vi.mock('@/lib/realtime', () => ({
  publishWorkOrderChanged: vi.fn(),
}));

import { PUT } from '@/app/api/production/work-orders/[id]/material-weighing/route';
import { ScaleVerificationError, SCALE_VERIFICATION_ERROR_CODES } from '@/types/scale-verification';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/production/work-orders/1/material-weighing', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: '1' }) };

describe('Material Weighing API — scale verification integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 7, role: 'production' });
  });

  it('passes scaleId + requireScaleVerification through to service', async () => {
    mockRecord.mockResolvedValue({ id: 1, weighedQty: 5, scaleId: 42, scaleVerificationId: 99 });
    const res = await PUT(
      makeReq({
        materialId: 1,
        weighedQty: 5,
        scaleId: 42,
        requireScaleVerification: true,
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ scaleId: 42, requireScaleVerification: true }),
    );
  });

  it('returns 409 VERIFICATION_REQUIRED when service rejects', async () => {
    mockRecord.mockRejectedValue(
      new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.VERIFICATION_REQUIRED,
        'Verify first',
      ),
    );
    const res = await PUT(
      makeReq({ materialId: 1, weighedQty: 5, scaleId: 42 }),
      params,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('VERIFICATION_REQUIRED');
  });

  it('allows water materials without scaleVerification', async () => {
    mockRecord.mockResolvedValue({ id: 1, weighedQty: 5 });
    const res = await PUT(
      makeReq({
        materialId: 1,
        weighedQty: 5,
        scaleId: 42,
        requireScaleVerification: false,
      }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ requireScaleVerification: false }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PUT(makeReq({ materialId: 1, weighedQty: 5 }), params);
    expect(res.status).toBe(401);
  });
});

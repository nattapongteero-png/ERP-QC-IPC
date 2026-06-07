/**
 * Goods Receipt QA endpoint Integration Tests
 * Verifies Triple Independence enforcement at the API layer.
 * Feature: 020-goods-receipt
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

const mockRelease = vi.fn();
const mockReject = vi.fn();
vi.mock('@/lib/services/goods-receipt-qa.service', () => ({
  qaReleaseLine: (lineId: number, sig: unknown, userId: number) =>
    mockRelease(lineId, sig, userId),
  qaRejectLine: (lineId: number, reason: string, sig: unknown, userId: number) =>
    mockReject(lineId, reason, sig, userId),
}));

import { POST } from '@/app/api/inventory/goods-receipts/[id]/lines/[lineId]/qa/route';
import { GoodsReceiptError, GOODS_RECEIPT_ERROR_CODES } from '@/types/goods-receipt';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/inventory/goods-receipts/1/lines/100/qa', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: '1', lineId: '100' }) };

describe('GRN QA endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 8, role: 'staff' });
    // New model: release = warehouse perm, reject = QC perm. Default grants both.
    mockGetPerms.mockResolvedValue(
      new Set(['inventory:goods_receipt:receive', 'quality:incoming:approve']),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when permission missing', async () => {
    mockGetPerms.mockResolvedValue(new Set());
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(403);
  });

  it('release requires the warehouse permission (QC-only perm is 403)', async () => {
    mockGetPerms.mockResolvedValue(new Set(['quality:incoming:approve']));
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(403);
  });

  it('reject requires the QC permission (warehouse-only perm is 403)', async () => {
    mockGetPerms.mockResolvedValue(new Set(['inventory:goods_receipt:receive']));
    const res = await POST(
      makeReq({ action: 'reject', rejectionReason: 'Contamination found on outer packaging', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 with TRIPLE_INDEPENDENCE_VIOLATION code when receiver tries to QA', async () => {
    mockRelease.mockRejectedValue(
      new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
        'TI violation',
      ),
    );
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('TRIPLE_INDEPENDENCE_VIOLATION');
  });

  it('returns 409 when QC not approved', async () => {
    mockRelease.mockRejectedValue(
      new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.QC_NOT_APPROVED, 'QC failed'),
    );
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('QC_NOT_APPROVED');
  });

  it('routes release action to qaReleaseLine', async () => {
    mockRelease.mockResolvedValue({
      line: { id: 100, status: 'released_to_stock' },
      lotStatus: 'released',
      deviationId: null,
    });
    const res = await POST(
      makeReq({ action: 'release', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lotStatus).toBe('released');
    expect(mockRelease).toHaveBeenCalledWith(100, { password: 'pw' }, 8);
  });

  it('routes reject action to qaRejectLine', async () => {
    mockReject.mockResolvedValue({
      line: { id: 100, status: 'rejected' },
      lotStatus: 'rejected',
      deviationId: 5,
    });
    const res = await POST(
      makeReq({
        action: 'reject',
        rejectionReason: 'Visible contamination on packaging',
        signature: { password: 'pw' },
      }),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviationId).toBe(5);
    expect(mockReject).toHaveBeenCalledWith(
      100,
      'Visible contamination on packaging',
      { password: 'pw' },
      8,
    );
  });

  it('rejects body with action=reject but no reason', async () => {
    const res = await POST(
      makeReq({ action: 'reject', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(400);
  });

  it('rejects body with action=reject and reason < 10 chars', async () => {
    const res = await POST(
      makeReq({ action: 'reject', rejectionReason: 'too short', signature: { password: 'pw' } }),
      params,
    );
    expect(res.status).toBe(400);
  });
});

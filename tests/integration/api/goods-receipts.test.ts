/**
 * Goods Receipts API Integration Tests
 * Feature: 020-goods-receipt
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth
const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin' || role === 'ADMIN',
}));

// Mock permission resolver
const mockGetPerms = vi.fn();
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

// Mock services
const mockCreateGrn = vi.fn();
const mockListGrns = vi.fn();
const mockGetGrnById = vi.fn();
const mockCancelGrn = vi.fn();
vi.mock('@/lib/services/goods-receipt.service', () => ({
  createGrn: (input: unknown, userId: number) => mockCreateGrn(input, userId),
  listGrns: (filter: unknown) => mockListGrns(filter),
  getGrnById: (id: number) => mockGetGrnById(id),
  cancelGrn: (id: number, reason: string, userId: number) => mockCancelGrn(id, reason, userId),
}));

import { GET, POST } from '@/app/api/inventory/goods-receipts/route';
import { GET as DETAIL_GET, DELETE as DETAIL_DELETE } from '@/app/api/inventory/goods-receipts/[id]/route';
import { GoodsReceiptError, GOODS_RECEIPT_ERROR_CODES } from '@/types/goods-receipt';

describe('Goods Receipts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 7, role: 'warehouse' });
    mockGetPerms.mockResolvedValue(new Set(['inventory:goods_receipt:receive']));
  });

  describe('GET /', () => {
    it('returns 401 when unauthenticated', async () => {
      mockSession.mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns list when authenticated', async () => {
      mockListGrns.mockResolvedValue({
        items: [{ id: 1, grnNumber: 'GRN-2026-00001', status: 'in_progress' }],
        total: 1,
        page: 1,
        pageSize: 50,
      });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].grnNumber).toBe('GRN-2026-00001');
    });

    it('passes status filter to service', async () => {
      mockListGrns.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts?status=released');
      await GET(req);
      expect(mockListGrns).toHaveBeenCalledWith(expect.objectContaining({ status: 'released' }));
    });

    it('passes pagination to service', async () => {
      mockListGrns.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 25 });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts?page=2&pageSize=25');
      await GET(req);
      expect(mockListGrns).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 25 }),
      );
    });
  });

  describe('POST /', () => {
    it('returns 403 when caller lacks permission', async () => {
      mockGetPerms.mockResolvedValue(new Set());
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'po',
          poId: 1,
          warehouseId: 1,
          receivedDate: '2026-06-03',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 400 for invalid body', async () => {
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({ sourceType: 'po' }), // missing poId, warehouseId, receivedDate
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 409 when source already received', async () => {
      mockCreateGrn.mockRejectedValue(
        new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.SOURCE_ALREADY_RECEIVED, 'PO done'),
      );
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'po',
          poId: 1,
          warehouseId: 1,
          receivedDate: '2026-06-03',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
    });

    it('returns 201 on successful create', async () => {
      mockCreateGrn.mockResolvedValue({
        grn: { id: 42, grnNumber: 'GRN-2026-00042' },
        lines: [{ id: 1 }, { id: 2 }],
      });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'po',
          poId: 1,
          warehouseId: 1,
          receivedDate: '2026-06-03',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.grn.grnNumber).toBe('GRN-2026-00042');
      expect(body.lines).toHaveLength(2);
      expect(mockCreateGrn).toHaveBeenCalledWith(expect.objectContaining({ poId: 1 }), 7);
    });

    it('allows admin even without explicit permission', async () => {
      mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
      mockGetPerms.mockResolvedValue(new Set()); // no perms
      mockCreateGrn.mockResolvedValue({
        grn: { id: 1, grnNumber: 'GRN-2026-00001' },
        lines: [],
      });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'po',
          poId: 1,
          warehouseId: 1,
          receivedDate: '2026-06-03',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
    });
  });

  describe('GET /[id]', () => {
    it('returns 404 when GRN not found', async () => {
      mockGetGrnById.mockRejectedValue(
        new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'missing'),
      );
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/999');
      const res = await DETAIL_GET(req, { params: Promise.resolve({ id: '999' }) });
      expect(res.status).toBe(404);
    });

    it('returns 400 for non-numeric id', async () => {
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/abc');
      const res = await DETAIL_GET(req, { params: Promise.resolve({ id: 'abc' }) });
      expect(res.status).toBe(400);
    });

    it('returns detail when found', async () => {
      mockGetGrnById.mockResolvedValue({
        grn: { id: 1, grnNumber: 'GRN-2026-00001' },
        lines: [{ id: 1, lineNumber: 1 }],
      });
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/1');
      const res = await DETAIL_GET(req, { params: Promise.resolve({ id: '1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.grn.id).toBe(1);
    });
  });

  describe('DELETE /[id] (cancel)', () => {
    it('rejects short reason', async () => {
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'short' }),
      });
      const res = await DETAIL_DELETE(req, { params: Promise.resolve({ id: '1' }) });
      expect(res.status).toBe(400);
    });

    it('returns 409 on CANCELLATION_WINDOW_EXPIRED', async () => {
      mockCancelGrn.mockRejectedValue(
        new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.CANCELLATION_WINDOW_EXPIRED, '24h passed'),
      );
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'Created with wrong PO by mistake' }),
      });
      const res = await DETAIL_DELETE(req, { params: Promise.resolve({ id: '1' }) });
      expect(res.status).toBe(409);
    });

    it('returns 403 on PERMISSION_DENIED', async () => {
      mockCancelGrn.mockRejectedValue(
        new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.PERMISSION_DENIED, 'Not creator'),
      );
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'Wrong PO selected when creating' }),
      });
      const res = await DETAIL_DELETE(req, { params: Promise.resolve({ id: '1' }) });
      expect(res.status).toBe(403);
    });

    it('returns success on valid cancel', async () => {
      mockCancelGrn.mockResolvedValue(undefined);
      const req = new NextRequest('http://localhost/api/inventory/goods-receipts/1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'Created with wrong supplier reference' }),
      });
      const res = await DETAIL_DELETE(req, { params: Promise.resolve({ id: '1' }) });
      expect(res.status).toBe(200);
    });
  });
});

/**
 * Standard Weights API — response envelope contract.
 *
 * Verifies the fix: GET and POST return { success, data } (not a bare array /
 * bare object), so the registry page's `res.data` / `res.success` reads work.
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

const mockList = vi.fn();
const mockCreate = vi.fn();
vi.mock('@/lib/services/scale-verification.service', () => ({
  listStandardWeights: (inc: boolean) => mockList(inc),
  createStandardWeight: (input: unknown, uid: number) => mockCreate(input, uid),
}));

import { GET, POST } from '@/app/api/master-data/standard-weights/route';

const VALID_BODY = {
  code: 'STD-1KG-001',
  denominationValue: 1,
  denominationUnit: 'kg',
  accuracyClass: 'F1',
  certificateNumber: 'CERT-2026-001',
  certificateIssuer: 'NIMT',
  certificateIssueDate: '2026-01-01',
  certificateExpiryDate: '2028-01-01',
  ownerDepartment: 'QC',
};

const postReq = (body: unknown) =>
  new NextRequest('http://localhost/api/master-data/standard-weights', {
    method: 'POST',
    body: JSON.stringify(body),
  });
const getReq = () =>
  new NextRequest('http://localhost/api/master-data/standard-weights', { method: 'GET' });

describe('GET /api/master-data/standard-weights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
  });

  it('401 unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it('returns { success:true, data:[...] } envelope', async () => {
    mockList.mockResolvedValue([
      { id: 1, code: 'STD-1KG-001', denominationValue: 1, denominationUnit: 'kg' },
    ]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe('STD-1KG-001');
  });
});

describe('POST /api/master-data/standard-weights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 5, role: 'admin' });
    mockGetPerms.mockResolvedValue(new Set(['quality:scales:configure']));
  });

  it('401 unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns { success:true, data } on create (201)', async () => {
    mockCreate.mockResolvedValue({ id: 9, ...VALID_BODY });
    const res = await POST(postReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(9);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('400 on invalid body (no envelope leakage)', async () => {
    const res = await POST(postReq({ code: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBeUndefined();
    expect(body.error).toBeDefined();
  });
});

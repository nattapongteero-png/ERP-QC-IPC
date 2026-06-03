/**
 * eBMR audit gap #6 — QA approval endpoint
 *
 * Hand-rolled mocks for the lightweight pieces we need so we can validate
 * the rule layer (status / triple-independence / re-approval) without the
 * Next.js request/response overhead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeWO {
  id: number;
  status: string;
  completedBy: number | null;
  qaApprovedBy: number | null;
}

interface FakeInspection {
  status: string;
  inspectorId: number | null;
  reInspectorId: number | null;
}

let woState: FakeWO | null = null;
let inspectionState: FakeInspection | null = null;
let lastWoUpdate: Record<string, unknown> | null = null;

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: vi.fn() }));
vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn((cols?: any) => ({
        from: vi.fn((tbl?: any) => ({
          where: vi.fn(() => {
            if (cols && 'status' in cols && 'inspectorId' in cols) {
              return Promise.resolve(inspectionState ? [inspectionState] : []);
            }
            return Promise.resolve(woState ? [woState] : []);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => {
          lastWoUpdate = vals;
          return { where: vi.fn().mockResolvedValue([{}]) };
        }),
      })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn((name: string) => ({ _name: name })),
}));
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
}));
vi.mock('@/lib/realtime', () => ({ publishWorkOrderChanged: vi.fn() }));
vi.mock('@/lib/api-utils', () => ({
  withAuth: (_req: any, fn: any) => fn({ userId: 99 }, _req),
  successResponse: (data: any, message?: string) =>
    new Response(JSON.stringify({ success: true, data, message }), { status: 200 }),
  errorResponse: (msg: string, status = 400) =>
    new Response(JSON.stringify({ success: false, error: msg }), { status }),
  serverErrorResponse: (err: any) =>
    new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500 }),
}));

import { POST } from '@/app/api/production/work-orders/[id]/qa-approve/route';

function buildRequest(body: Record<string, unknown>) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as any;
}

const params = Promise.resolve({ id: '42' });

beforeEach(() => {
  lastWoUpdate = null;
  inspectionState = null;
});

describe('POST /qa-approve — preconditions', () => {
  it('404 when WO not found', async () => {
    woState = null;
    const res = await POST(buildRequest({}), { params });
    expect(res.status).toBe(404);
  });

  it('409 when already QA-approved', async () => {
    woState = { id: 42, status: 'completed', completedBy: 1, qaApprovedBy: 5 };
    const res = await POST(buildRequest({}), { params });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/QA approve/i) });
  });

  it('400 when status is not completed/closed', async () => {
    woState = { id: 42, status: 'in_progress', completedBy: 1, qaApprovedBy: null };
    const res = await POST(buildRequest({}), { params });
    expect(res.status).toBe(400);
  });
});

describe('POST /qa-approve — triple independence', () => {
  it('409 when QA == Producer (completedBy)', async () => {
    woState = { id: 42, status: 'completed', completedBy: 99, qaApprovedBy: null };
    const res = await POST(buildRequest({}), { params });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/Produced By/i),
    });
  });

  it('409 when QA == QC inspector of the passed finished inspection', async () => {
    woState = { id: 42, status: 'completed', completedBy: 1, qaApprovedBy: null };
    inspectionState = { status: 'passed', inspectorId: 99, reInspectorId: null };
    const res = await POST(buildRequest({}), { params });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/Verified By \(QC\)/i),
    });
  });

  it('happy path: signs WO, returns 200, includes qaApprovedBy', async () => {
    woState = { id: 42, status: 'completed', completedBy: 1, qaApprovedBy: null };
    inspectionState = { status: 'passed', inspectorId: 2, reInspectorId: null };
    const res = await POST(buildRequest({ notes: 'Looks clean' }), { params });
    expect(res.status).toBe(200);
    expect(lastWoUpdate).toMatchObject({ qaApprovedBy: 99 });
    expect(lastWoUpdate?.qaApprovalNotes).toBe('Looks clean');
  });
});

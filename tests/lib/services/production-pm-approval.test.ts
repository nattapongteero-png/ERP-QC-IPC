/**
 * Production Audit fix — Production Manager approval for critical SOP steps
 * Audit issue: #16
 *
 * Triple Independence: Operator ≠ Verifier ≠ PM.
 * Non-critical steps don't require PM approval.
 * Step must be 'verified' before PM can approve.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockState: any = {};

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: vi.fn(),
}));

const fakeSelectQuery = (returnValue: any) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(returnValue),
  }),
});

vi.mock('@/lib/db/db-helper', () => ({
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn((cols?: any) => {
        const isBomStepQuery = cols && 'isCritical' in cols;
        const isStepQuery = cols && 'operatorId' in cols;
        if (isStepQuery) return fakeSelectQuery([mockState.step].filter(Boolean));
        if (isBomStepQuery) return fakeSelectQuery([mockState.bomStep].filter(Boolean));
        return fakeSelectQuery([]);
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 1, pmApprovedBy: 99, pmApprovedAt: new Date() }]),
          })),
        })),
      })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn(),
  getInsertId: vi.fn(() => 1),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date()),
  getTodayStr: vi.fn(() => '2026-06-03'),
  toDbDate: vi.fn((v: string) => v),
  toDateSafe: vi.fn((v: any) => v),
  formatDateFromDb: vi.fn((v: any) => v),
  toQueryDate: vi.fn((v: any) => v),
}));

vi.mock('@/lib/db/audit-wrapper', () => ({
  auditedInsert: vi.fn(),
  auditedUpdate: vi.fn(),
  auditedDelete: vi.fn(),
}));

import { pmApproveWOSOPStep } from '@/lib/services/wo-execution.service';

describe('Audit #16 — PM approval rules', () => {
  beforeEach(() => {
    mockState = {};
  });

  it('rejects when step not found', async () => {
    mockState = { step: null };
    await expect(pmApproveWOSOPStep(1, 99)).rejects.toThrow('SOP execution not found');
  });

  it('rejects when step status != verified', async () => {
    mockState = {
      step: { operatorId: 1, verifierId: 2, bomStepId: 10, status: 'completed' },
    };
    await expect(pmApproveWOSOPStep(1, 99)).rejects.toThrow(/STEP_NOT_VERIFIED/);
  });

  it('rejects when bomStep is NOT critical', async () => {
    mockState = {
      step: { operatorId: 1, verifierId: 2, bomStepId: 10, status: 'verified' },
      bomStep: { isCritical: false },
    };
    await expect(pmApproveWOSOPStep(1, 99)).rejects.toThrow(/STEP_NOT_CRITICAL/);
  });

  it('rejects when PM is the operator (Triple Independence)', async () => {
    mockState = {
      step: { operatorId: 99, verifierId: 2, bomStepId: 10, status: 'verified' },
      bomStep: { isCritical: true },
    };
    await expect(pmApproveWOSOPStep(1, 99)).rejects.toThrow(/PM_SAME_AS_OPERATOR/);
  });

  it('rejects when PM is the verifier (Triple Independence)', async () => {
    mockState = {
      step: { operatorId: 1, verifierId: 99, bomStepId: 10, status: 'verified' },
      bomStep: { isCritical: true },
    };
    await expect(pmApproveWOSOPStep(1, 99)).rejects.toThrow(/PM_SAME_AS_VERIFIER/);
  });

  it('allows PM approval when all rules pass', async () => {
    mockState = {
      step: { operatorId: 1, verifierId: 2, bomStepId: 10, status: 'verified' },
      bomStep: { isCritical: true },
    };
    const result = await pmApproveWOSOPStep(1, 99);
    expect(result).toBeDefined();
    expect(result.pmApprovedBy).toBe(99);
  });
});

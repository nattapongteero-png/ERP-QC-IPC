/**
 * Integration tests for Procedure Step ↔ IPC Criteria link service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ _op: 'eq', a, b }),
  and: (...args: unknown[]) => ({ _op: 'and', args }),
  asc: (col: unknown) => ({ _op: 'asc', col }),
  inArray: (col: unknown, arr: unknown) => ({ _op: 'inArray', col, arr }),
}));

const mockTableRef = {
  id: 'id',
  procedureStepId: 'procedureStepId',
  criteriaId: 'criteriaId',
  sequence: 'sequence',
  sampleSize: 'sampleSize',
  isCritical: 'isCritical',
  notes: 'notes',
  code: 'code',
  name: 'name',
  nameTh: 'nameTh',
  specification: 'specification',
  minValue: 'minValue',
  maxValue: 'maxValue',
  unit: 'unit',
  specTarget: 'specTarget',
  specTolerancePercent: 'specTolerancePercent',
  criteriaType: 'criteriaType',
  testMethod: 'testMethod',
};

let selectResults: unknown[] = [];
let insertCalls: unknown[] = [];
let updateCalls: unknown[] = [];
let deleteCalls: unknown[] = [];

const fakeDb = () => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve(selectResults)),
        limit: vi.fn(() => Promise.resolve(selectResults)),
      })),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(selectResults)),
        })),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn((v: unknown) => {
      insertCalls.push(v);
      return Promise.resolve({ lastInsertRowid: 42 });
    }),
  })),
  update: vi.fn(() => ({
    set: vi.fn((v: unknown) => {
      updateCalls.push(v);
      return { where: vi.fn(() => Promise.resolve()) };
    }),
  })),
  delete: vi.fn(() => ({
    where: vi.fn((w: unknown) => {
      deleteCalls.push(w);
      return Promise.resolve();
    }),
  })),
});

vi.mock('@/lib/db/db-helper', () => ({
  executeDbOperation: vi.fn((fn: (db: unknown) => unknown) => fn(fakeDb())),
  getTableRef: vi.fn(() => mockTableRef),
  getInsertId: vi.fn(() => 42),
}));

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: vi.fn(),
}));

import {
  listProcedureStepIPC,
  listIPCForSteps,
  addProcedureStepIPC,
  updateProcedureStepIPC,
  removeProcedureStepIPC,
} from '@/lib/services/sop-template-ipc.service';

beforeEach(() => {
  selectResults = [];
  insertCalls = [];
  updateCalls = [];
  deleteCalls = [];
});

describe('listProcedureStepIPC', () => {
  it('returns rows joined with ipc_criteria', async () => {
    selectResults = [
      {
        id: 1,
        procedureStepId: 20,
        criteriaId: 100,
        sequence: 1,
        sampleSize: 5,
        isCritical: true,
        notes: null,
        criteriaCode: 'IPC-WT',
        criteriaName: 'Weight Check',
        criteriaNameTh: 'ตรวจน้ำหนัก',
        specification: '200 ± 10',
        minValue: 190,
        maxValue: 210,
        unit: 'mg',
        criteriaType: 'numeric',
      },
    ];
    const rows = await listProcedureStepIPC(20);
    expect(rows).toHaveLength(1);
    expect(rows[0].criteriaCode).toBe('IPC-WT');
    expect(rows[0].procedureStepId).toBe(20);
  });

  it('returns empty array when no criteria linked', async () => {
    selectResults = [];
    const rows = await listProcedureStepIPC(99);
    expect(rows).toEqual([]);
  });
});

describe('listIPCForSteps (batch)', () => {
  it('short-circuits when step id list is empty', async () => {
    const grouped = await listIPCForSteps([]);
    expect(grouped).toEqual({});
  });

  it('groups rows by procedureStepId', async () => {
    selectResults = [
      { id: 1, procedureStepId: 20, criteriaId: 100, sequence: 1, sampleSize: 5, isCritical: false, notes: null, criteriaCode: 'A' },
      { id: 2, procedureStepId: 20, criteriaId: 101, sequence: 2, sampleSize: 3, isCritical: true, notes: null, criteriaCode: 'B' },
      { id: 3, procedureStepId: 21, criteriaId: 100, sequence: 1, sampleSize: 5, isCritical: false, notes: null, criteriaCode: 'C' },
    ];
    const grouped = await listIPCForSteps([20, 21]);
    expect(grouped[20]).toHaveLength(2);
    expect(grouped[21]).toHaveLength(1);
    expect(grouped[20][0].criteriaCode).toBe('A');
  });
});

describe('addProcedureStepIPC', () => {
  it('rejects duplicate (step, criteria) pair', async () => {
    selectResults = [{ id: 99 }];
    await expect(
      addProcedureStepIPC({ procedureStepId: 20, criteriaId: 100 })
    ).rejects.toThrow(/DUPLICATE:/);
  });

  it('inserts new link when no duplicate exists', async () => {
    selectResults = [];
    const result = await addProcedureStepIPC({
      procedureStepId: 20,
      criteriaId: 100,
      sequence: 3,
      sampleSize: 5,
      isCritical: true,
      notes: 'Critical check',
    });
    expect(result.id).toBe(42);
    expect(insertCalls).toHaveLength(1);
    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.procedureStepId).toBe(20);
    expect(payload.criteriaId).toBe(100);
    expect(payload.sequence).toBe(3);
    expect(payload.sampleSize).toBe(5);
    expect(payload.isCritical).toBe(true);
    expect(payload.notes).toBe('Critical check');
  });

  it('applies defaults when optional fields omitted', async () => {
    selectResults = [];
    await addProcedureStepIPC({ procedureStepId: 20, criteriaId: 100 });
    const payload = insertCalls[0] as Record<string, unknown>;
    expect(payload.sequence).toBe(1);
    expect(payload.sampleSize).toBe(1);
    expect(payload.isCritical).toBe(false);
    expect(payload.notes).toBe(null);
  });
});

describe('updateProcedureStepIPC', () => {
  it('updates only provided fields', async () => {
    await updateProcedureStepIPC(42, { sampleSize: 10, isCritical: true });
    expect(updateCalls).toHaveLength(1);
    const patch = updateCalls[0] as Record<string, unknown>;
    expect(patch.sampleSize).toBe(10);
    expect(patch.isCritical).toBe(true);
    expect(patch.sequence).toBeUndefined();
  });

  it('is a no-op when no fields provided', async () => {
    await updateProcedureStepIPC(42, {});
    expect(updateCalls).toHaveLength(0);
  });
});

describe('removeProcedureStepIPC', () => {
  it('issues a delete with the given id', async () => {
    await removeProcedureStepIPC(42);
    expect(deleteCalls).toHaveLength(1);
  });
});

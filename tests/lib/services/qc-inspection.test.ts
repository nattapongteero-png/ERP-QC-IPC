/**
 * QC Inspection — Audit Q5
 * Tests cover number generation, validation, and the create/update paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let nextInsertedRow: any = null;
let existingMaxNumber: string | null = null;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: vi.fn(),
}));

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  executeDbOperation: vi.fn(async (fn: any) => {
    const fakeDb: any = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(
                existingMaxNumber ? [{ inspectionNumber: existingMaxNumber }] : [],
              ),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((v: any) => ({
          returning: vi.fn().mockResolvedValue([
            { ...v, id: 42, ...(nextInsertedRow || {}) },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 1, ...nextInsertedRow }]),
          })),
        })),
      })),
    };
    return fn(fakeDb);
  }),
  getTableRef: vi.fn(() => ({
    inspectionNumber: 'inspection_number',
    id: 'id',
  })),
  getInsertId: vi.fn(() => 42),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => new Date('2026-06-03T00:00:00.000Z')),
}));

import {
  createInspection,
  updateInspection,
} from '@/lib/services/qc-inspection.service';

describe('QC Inspection — create', () => {
  beforeEach(() => {
    nextInsertedRow = null;
    existingMaxNumber = null;
  });

  it('rejects when subject is missing', async () => {
    await expect(
      createInspection({
        inspectionType: 'incoming',
        subject: '',
        inspectorId: 1,
      } as any),
    ).rejects.toThrow(/subject/);
  });

  it('rejects when inspectorId is missing', async () => {
    await expect(
      createInspection({
        inspectionType: 'incoming',
        subject: 'lot 42',
        inspectorId: 0,
      } as any),
    ).rejects.toThrow(/inspectorId/);
  });

  it('generates QCI-{YYYY}-0001 on first call of the year', async () => {
    existingMaxNumber = null;
    const row = await createInspection({
      inspectionType: 'incoming',
      subject: 'Pre-receive check',
      inspectorId: 9,
    });
    expect(row.inspectionNumber).toMatch(/^QCI-\d{4}-0001$/);
  });

  it('increments past the highest existing number', async () => {
    existingMaxNumber = 'QCI-2026-0007';
    const row = await createInspection({
      inspectionType: 'in_process',
      subject: 'Mid-batch QC',
      inspectorId: 9,
    });
    expect(row.inspectionNumber).toBe('QCI-2026-0008');
  });

  it('defaults overallResult to pending', async () => {
    existingMaxNumber = null;
    const row = await createInspection({
      inspectionType: 'finished',
      subject: 'Final QC',
      inspectorId: 9,
    });
    expect(row.overallResult).toBe('pending');
  });
});

describe('QC Inspection — update', () => {
  beforeEach(() => {
    nextInsertedRow = null;
  });

  it('updates only the fields provided', async () => {
    nextInsertedRow = { overallResult: 'pass', findings: 'all good' };
    const row = await updateInspection(1, { overallResult: 'pass', findings: 'all good' });
    expect(row.overallResult).toBe('pass');
    expect(row.findings).toBe('all good');
  });
});

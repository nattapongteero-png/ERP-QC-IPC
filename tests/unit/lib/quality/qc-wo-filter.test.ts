/**
 * QC Inspection ↔ Work Order relevance helpers.
 *
 * Guards the rule that a QC inspection's type determines which Work Orders may
 * be linked — so the "ใบตรวจใหม่" dialog never offers an unrelated WO and shows
 * meaningful option labels instead of bare numbers.
 */

import { describe, it, expect } from 'vitest';
import {
  type WorkOrderLite,
  WO_STATUS_BY_TYPE,
  isWoLinkEnabled,
  filterWorkOrders,
  woOptionLabel,
} from '@/lib/quality/qc-wo-filter';

const wo = (over: Partial<WorkOrderLite>): WorkOrderLite => ({
  id: 1,
  woNumber: 'WO-2569-001',
  status: 'in_progress',
  productName: null,
  productCode: null,
  batchNumber: null,
  ...over,
});

// One WO per status across the lifecycle.
const ALL_WOS: WorkOrderLite[] = [
  wo({ id: 1, status: 'planned' }),
  wo({ id: 2, status: 'released' }),
  wo({ id: 3, status: 'in_progress' }),
  wo({ id: 4, status: 'completed' }),
  wo({ id: 5, status: 'closed' }),
  wo({ id: 6, status: 'cancelled' }),
];

describe('isWoLinkEnabled', () => {
  it('disables WO linking for incoming (raw-material receipt)', () => {
    expect(isWoLinkEnabled('incoming')).toBe(false);
  });

  it('enables WO linking for in_process, finished, and ad_hoc', () => {
    expect(isWoLinkEnabled('in_process')).toBe(true);
    expect(isWoLinkEnabled('finished')).toBe(true);
    expect(isWoLinkEnabled('ad_hoc')).toBe(true);
  });
});

describe('filterWorkOrders', () => {
  it('returns no WOs for incoming — inspection is not tied to production', () => {
    expect(filterWorkOrders(ALL_WOS, 'incoming')).toEqual([]);
  });

  it('in_process shows only released / in_progress WOs', () => {
    const result = filterWorkOrders(ALL_WOS, 'in_process');
    expect(result.map((w) => w.status).sort()).toEqual(['in_progress', 'released']);
  });

  it('finished shows only completed / closed WOs', () => {
    const result = filterWorkOrders(ALL_WOS, 'finished');
    expect(result.map((w) => w.status).sort()).toEqual(['closed', 'completed']);
  });

  it('ad_hoc shows every WO regardless of status', () => {
    expect(filterWorkOrders(ALL_WOS, 'ad_hoc')).toHaveLength(ALL_WOS.length);
  });

  it('never surfaces a WO for one type that belongs to the opposite type', () => {
    // A completed WO must not appear under in_process, and vice versa.
    const inProcess = filterWorkOrders(ALL_WOS, 'in_process');
    const finished = filterWorkOrders(ALL_WOS, 'finished');
    expect(inProcess.some((w) => w.status === 'completed')).toBe(false);
    expect(finished.some((w) => w.status === 'in_progress')).toBe(false);
  });

  it('returns empty when there are no WOs in the relevant status', () => {
    const onlyPlanned = [wo({ status: 'planned' })];
    expect(filterWorkOrders(onlyPlanned, 'in_process')).toEqual([]);
    expect(filterWorkOrders(onlyPlanned, 'finished')).toEqual([]);
  });
});

describe('woOptionLabel', () => {
  it('shows WO number, product name, and batch — not a bare number', () => {
    const label = woOptionLabel(
      wo({ woNumber: 'WO-2569-001', productName: 'พาราเซตามอล', batchNumber: 'B123' }),
    );
    expect(label).toBe('WO-2569-001 — พาราเซตามอล · batch B123');
  });

  it('falls back to product code when name is missing', () => {
    const label = woOptionLabel(
      wo({ woNumber: 'WO-2', productName: null, productCode: 'FG-001', batchNumber: null }),
    );
    expect(label).toBe('WO-2 — FG-001');
  });

  it('shows only batch when product info is missing', () => {
    const label = woOptionLabel(
      wo({ woNumber: 'WO-3', productName: null, productCode: null, batchNumber: 'B9' }),
    );
    expect(label).toBe('WO-3 · batch B9');
  });

  it('degrades to the bare WO number when nothing else is known', () => {
    const label = woOptionLabel(
      wo({ woNumber: 'WO-4', productName: null, productCode: null, batchNumber: null }),
    );
    expect(label).toBe('WO-4');
  });
});

describe('WO_STATUS_BY_TYPE config', () => {
  it('covers every inspection type exactly once', () => {
    expect(Object.keys(WO_STATUS_BY_TYPE).sort()).toEqual([
      'ad_hoc',
      'finished',
      'in_process',
      'incoming',
    ]);
  });
});

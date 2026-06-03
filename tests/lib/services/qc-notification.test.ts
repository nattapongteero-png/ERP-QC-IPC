/**
 * QC Notification trigger wrappers — Audit QC1/QC4
 *
 * Validates that the wrappers around equipment-notification.service.createNotification
 * pass through the right entityType/type/severity/recipientRole.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSpy = vi.fn(async (input: any) => ({ id: 1, ...input }));

vi.mock('@/lib/services/equipment-notification.service', () => ({
  createNotification: (input: any) => createSpy(input),
}));

import {
  notifyLotReceived,
  notifyWOCompleted,
  notifyDeviationOpened,
} from '@/lib/services/qc-notification.service';

beforeEach(() => createSpy.mockClear());

describe('notifyLotReceived', () => {
  it('sets entityType=inventory_lot + type=lot_received + role=qc', async () => {
    await notifyLotReceived({
      lotId: 42,
      lotNumber: 'L-2026-007',
      itemCode: 'RM-001',
      itemName: 'Herb A',
      quantity: 100,
      unit: 'kg',
      warehouseName: 'WH-RM',
    });
    expect(createSpy).toHaveBeenCalledOnce();
    const arg = createSpy.mock.calls[0][0];
    expect(arg.entityType).toBe('inventory_lot');
    expect(arg.entityId).toBe(42);
    expect(arg.type).toBe('lot_received');
    expect(arg.severity).toBe('info');
    expect(arg.recipientRole).toBe('qc');
    expect(arg.title).toMatch(/L-2026-007/);
    expect(arg.body).toMatch(/WH-RM/);
  });
});

describe('notifyWOCompleted', () => {
  it('sets entityType=work_order + type=wo_completed + role=qc', async () => {
    await notifyWOCompleted({
      workOrderId: 7,
      woNumber: 'WO-2569-007',
      batchNumber: 'B25690007',
      productName: 'Tablet A',
      actualQuantity: 488,
      unit: 'tab',
    });
    const arg = createSpy.mock.calls[0][0];
    expect(arg.entityType).toBe('work_order');
    expect(arg.entityId).toBe(7);
    expect(arg.type).toBe('wo_completed');
    expect(arg.recipientRole).toBe('qc');
    expect(arg.body).toMatch(/488/);
  });
});

describe('notifyDeviationOpened', () => {
  it('uses overdue severity for critical deviations', async () => {
    await notifyDeviationOpened({
      deviationId: 99,
      deviationNumber: 'DEV-202606-0001',
      title: 'OOS on assay',
      severity: 'critical',
      workOrderId: 7,
      woNumber: 'WO-2569-007',
    });
    const arg = createSpy.mock.calls[0][0];
    expect(arg.entityType).toBe('deviation');
    expect(arg.entityId).toBe(99);
    expect(arg.type).toBe('deviation_opened');
    expect(arg.severity).toBe('overdue');
    expect(arg.body).toMatch(/WO-2569-007/);
  });

  it('uses info severity for non-critical deviations', async () => {
    await notifyDeviationOpened({
      deviationId: 100,
      deviationNumber: 'DEV-202606-0002',
      title: 'Minor variance',
      severity: 'minor',
    });
    const arg = createSpy.mock.calls[0][0];
    expect(arg.severity).toBe('info');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { realtimeBus } from '@/lib/realtime/event-bus';
import type { RealtimeEvent } from '@/lib/realtime/types';

describe('realtimeBus', () => {
  beforeEach(() => {
    realtimeBus.removeAllListeners();
  });

  it('publish and subscribe deliver matching topic events', () => {
    const received: RealtimeEvent[] = [];
    const unsub = realtimeBus.subscribe('requisition-changed', (e) => received.push(e));

    realtimeBus.publish('requisition-changed', { workOrderId: 1, status: 'approved' });

    expect(received).toHaveLength(1);
    expect(received[0].topic).toBe('requisition-changed');
    expect(received[0].data.workOrderId).toBe(1);
    expect(received[0].data.status).toBe('approved');

    unsub();
  });

  it('unsubscribe removes listener', () => {
    const received: RealtimeEvent[] = [];
    const unsub = realtimeBus.subscribe('requisition-changed', (e) => received.push(e));
    unsub();

    realtimeBus.publish('requisition-changed', { workOrderId: 2, status: 'approved' });

    expect(received).toHaveLength(0);
  });

  it('multiple subscribers all receive event', () => {
    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];
    realtimeBus.subscribe('requisition-changed', (e) => a.push(e));
    realtimeBus.subscribe('requisition-changed', (e) => b.push(e));

    realtimeBus.publish('requisition-changed', { workOrderId: 3, status: 'approved' });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('event includes timestamp within request window', () => {
    const received: RealtimeEvent[] = [];
    realtimeBus.subscribe('requisition-changed', (e) => received.push(e));

    const before = Date.now();
    realtimeBus.publish('requisition-changed', { workOrderId: 4, status: 'approved' });
    const after = Date.now();

    expect(received[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(received[0].timestamp).toBeLessThanOrEqual(after);
  });
});

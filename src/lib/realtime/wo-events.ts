/**
 * Work-order realtime publish helper.
 *
 * Single entry-point so API handlers don't have to know the topic name or
 * payload shape — they just call publishWorkOrderChanged() after a mutation
 * succeeds. Subscribers (the various WO sub-pages) receive the event with
 * a section discriminator and decide which queries to invalidate.
 *
 * Never throws — realtime delivery is best-effort and must not block writes.
 */

import { realtimeBus } from './event-bus';
import type { WorkOrderSection, WorkOrderChangedPayload } from './types';

export function publishWorkOrderChanged(
  workOrderId: number,
  section: WorkOrderSection,
  changedBy: number,
  detail?: string,
): void {
  if (!Number.isFinite(workOrderId) || workOrderId <= 0) return;
  const payload: WorkOrderChangedPayload = {
    workOrderId,
    section,
    changedBy,
    ...(detail ? { detail } : {}),
  };
  try {
    realtimeBus.publish('work-order-changed', payload);
  } catch {
    // Swallow — realtime sync is best-effort
  }
}

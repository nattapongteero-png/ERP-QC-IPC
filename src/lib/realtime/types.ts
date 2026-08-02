export type TopicName = 'requisition-changed' | 'work-order-changed';

export interface RealtimeEvent {
  topic: TopicName;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface RequisitionChangedPayload extends Record<string, unknown> {
  workOrderId: number;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  changedBy: number;
}

/**
 * Fired when any execution sub-section of a work order is mutated:
 * cleaning logs, material weighing, SOP execution, IPC tests, environmental
 * logs, finished inspection, packaging materials, QC tests, production output,
 * status changes. Pages subscribe and invalidate the queries they care about.
 */
export type WorkOrderSection =
  | 'cleaning'
  | 'equipment-inspection'
  | 'material-weighing'
  | 'sop-execution'
  | 'ipc'
  | 'environmental'
  | 'finished-inspection'
  | 'packaging-materials'
  | 'packaging-weight'
  | 'packaging-integrity'
  | 'qc-tests'
  | 'production-output'
  | 'operations'
  | 'status'
  | 'line-clearance'
  | 'requisition'
  | 'qa-approve';

export interface WorkOrderChangedPayload extends Record<string, unknown> {
  workOrderId: number;
  section: WorkOrderSection;
  changedBy: number;
  /** Optional sub-discriminator (e.g. cleaning phase: 'pre_production') */
  detail?: string;
}

export type TopicName = 'requisition-changed';

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

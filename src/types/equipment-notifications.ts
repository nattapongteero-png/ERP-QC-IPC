/**
 * Equipment Maintenance Notifications — Types
 * Feature: 022-equipment-notifications
 */

export type NotificationType =
  | 'maintenance_due'
  | 'calibration_due'
  | 'scale_failure'
  | 'verification_expired'
  | 'inspection_due';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'maintenance_due',
  'calibration_due',
  'scale_failure',
  'verification_expired',
  'inspection_due',
];

export type NotificationSeverity = 'overdue' | 'due_today' | 'due_in_7d' | 'due_in_30d' | 'info';

export const NOTIFICATION_SEVERITIES: NotificationSeverity[] = [
  'overdue',
  'due_today',
  'due_in_7d',
  'due_in_30d',
  'info',
];

export type NotificationStatus = 'open' | 'acknowledged' | 'snoozed' | 'dismissed' | 'resolved';

export interface EquipmentNotification {
  id: number;
  entityType: string; // 'equipment' | 'accounting_equipment' | 'production_equipment' | 'scale'
  entityId: number;
  scheduleId: number | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  dueAt: string | null;
  status: NotificationStatus;
  recipientUserId: number | null;
  recipientRole: string | null;
  acknowledgedAt: string | null;
  acknowledgedByUserId: number | null;
  acknowledgeNote: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePlanTemplate {
  id: number;
  name: string;
  description: string | null;
  maintenanceType: string; // preventive | calibration | inspection | corrective
  intervalType: 'days' | 'weeks' | 'months' | 'hours' | 'units';
  intervalValue: number;
  alertDaysBefore: number;
  isActive: boolean;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationError {
  code: string;
  message: string;
}

export const NOTIFICATION_ERROR_CODES = {
  ALREADY_ACKNOWLEDGED: 'ALREADY_ACKNOWLEDGED',
  ALREADY_RESOLVED: 'ALREADY_RESOLVED',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_TEMPLATE: 'INVALID_TEMPLATE',
  EQUIPMENT_NOT_FOUND: 'EQUIPMENT_NOT_FOUND',
} as const;

export type NotificationErrorCode =
  (typeof NOTIFICATION_ERROR_CODES)[keyof typeof NOTIFICATION_ERROR_CODES];

export class EquipmentNotificationError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EquipmentNotificationError';
  }
}

/**
 * Classify severity given an ISO date.
 * Past date = overdue. Today = due_today. Within 7 days = due_in_7d. Within 30 = due_in_30d.
 */
export function classifySeverity(dueAtIso: string, now: Date = new Date()): NotificationSeverity {
  const due = new Date(dueAtIso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const ms = dueDay.getTime() - today.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  if (days <= 7) return 'due_in_7d';
  if (days <= 30) return 'due_in_30d';
  return 'info';
}

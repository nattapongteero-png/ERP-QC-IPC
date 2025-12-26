/**
 * Audit Log Types
 *
 * Shared types for audit trail functionality across all modules.
 */

// Action types matching both database schema and UI display
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'RESERVE'
  | 'ISSUE'
  | 'RECEIVE'
  | 'TRANSFER'
  | 'ADJUST'
  | 'RELEASE'
  | 'BLOCK'
  | 'SYNC'
  | 'VIEW'
  | 'DOWNLOAD'
  | 'SUBMIT'
  | 'ASSIGN'
  | 'COMMENT'
  | 'CLOSE'
  | 'REOPEN';

// Raw audit log from database
export interface AuditLogRecord {
  id: number;
  userId: number | null;
  action: string;
  tableName: string | null;
  recordId: number | null;
  oldValue: string | null; // JSON string
  newValue: string | null; // JSON string
  ipAddress: string | null;
  createdAt: string | Date;
}

// Enriched audit log with user info
export interface AuditLog {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: AuditAction | string;
  tableName: string | null;
  recordId: number | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// Field-level change for diff display
export interface FieldChange {
  fieldName: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
}

// Filter options for querying audit logs
export interface AuditLogFilters {
  tableName?: string;
  recordId?: number;
  userId?: number;
  action?: AuditAction | string;
  fromDate?: string;
  toDate?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
}

// API response for audit logs
export interface AuditLogResponse {
  success: boolean;
  data?: AuditLog[];
  total?: number;
  error?: string;
}

// Props for the AuditLogViewerDialog component
export interface AuditLogViewerDialogProps {
  /** Entity table name (e.g., 'templateItems', 'accountingInvoices') */
  entityType: string;
  /** Entity record ID */
  entityId: number;
  /** Dialog title */
  title?: string;
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Optional field label mappings for better display */
  fieldLabels?: Record<string, string>;
}

// Thai labels for actions
export const ACTION_LABELS_TH: Record<string, string> = {
  CREATE: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  APPROVE: 'อนุมัติ',
  REJECT: 'ปฏิเสธ',
  RESERVE: 'จอง',
  ISSUE: 'เบิก',
  RECEIVE: 'รับ',
  TRANSFER: 'โอน',
  ADJUST: 'ปรับปรุง',
  RELEASE: 'ปล่อย',
  BLOCK: 'ระงับ',
  SYNC: 'ซิงค์',
  VIEW: 'ดู',
  DOWNLOAD: 'ดาวน์โหลด',
  SUBMIT: 'ส่ง',
  ASSIGN: 'มอบหมาย',
  COMMENT: 'ความคิดเห็น',
  CLOSE: 'ปิด',
  REOPEN: 'เปิดใหม่',
};

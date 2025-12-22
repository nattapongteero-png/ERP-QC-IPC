// Recalls Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 9)

// ============================================
// Enums
// ============================================

export type RecallClass = 'class_i' | 'class_ii' | 'class_iii';

export type RecallStatus = 'initiated' | 'in_progress' | 'completed' | 'closed';

export type NotificationMethod = 'phone' | 'email' | 'fax' | 'courier';

export type NotificationResponseStatus = 'pending' | 'acknowledged' | 'returning' | 'returned' | 'unresponsive';

// ============================================
// Recalls
// ============================================

export interface Recall {
  id: number;
  recallNumber: string;
  initiatedDate: string;
  recallClass: RecallClass;
  reason: string;
  productId: number;
  productName?: string;
  affectedLots: number[]; // Array of lot IDs
  affectedLotNumbers?: string[]; // Lot numbers for display
  status: RecallStatus;
  distributedQuantity: number;
  returnedQuantity: number;
  reconciledQuantity: number;
  effectivenessRate: number; // % reconciled
  regulatoryReportDate: string | null;
  closureDate: string | null;
  coordinatorId: number;
  coordinatorName?: string;
  complaintId: number | null;
  complaintNumber?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecallCreate {
  recallClass: RecallClass;
  reason: string;
  productId: number;
  affectedLots: number[]; // Lot IDs
  coordinatorId: number;
  complaintId?: number;
}

export interface RecallUpdate {
  status?: RecallStatus;
  regulatoryReportDate?: string;
}

export interface RecallDetails extends Recall {
  notifications: RecallNotification[];
  reconciliation: RecallReconciliation[];
  complaint?: object; // Source complaint if any
}

// ============================================
// Distribution Records
// ============================================

export interface DistributionRecord {
  customerId: number;
  customerName: string;
  contactInfo: string;
  lotId: number;
  lotNumber: string;
  quantityDistributed: number;
  shipDate: string;
}

// ============================================
// Recall Notifications
// ============================================

export interface RecallNotification {
  id: number;
  recallId: number;
  customerId: number;
  customerName: string;
  contactInfo: string;
  quantityDistributed: number;
  notificationMethod: NotificationMethod;
  notifiedAt: string | null;
  acknowledgedAt: string | null;
  responseStatus: NotificationResponseStatus;
  quantityReturned: number;
  notes: string | null;
}

export interface RecallNotificationCreate {
  customerId: number;
  notificationMethod: NotificationMethod;
  notes?: string;
}

export interface RecallNotificationUpdate {
  responseStatus?: NotificationResponseStatus;
  quantityReturned?: number;
  notes?: string;
}

// ============================================
// Recall Reconciliation
// ============================================

export interface RecallReconciliation {
  id: number;
  recallId: number;
  lotId: number;
  lotNumber?: string;
  distributedQty: number;
  returnedQty: number;
  destroyedQty: number;
  accountedQty: number;
  unaccountedQty: number;
  reconciliationNotes: string | null;
  verifiedBy: number | null;
  verifiedByName?: string;
  verifiedAt: string | null;
}

export interface RecallReconciliationCreate {
  lotId: number;
  returnedQty?: number;
  destroyedQty?: number;
  accountedQty?: number;
  reconciliationNotes?: string;
}

// ============================================
// Mock Drill
// ============================================

export interface MockDrillResult {
  drillId: string;
  lotId: number;
  lotNumber: string;
  executedAt: string;
  customersIdentified: number;
  totalDistributed: number;
  timeToIdentify: number; // Seconds to retrieve distribution data
  passedTarget: boolean; // Met 4-hour target
  distributionReport: DistributionRecord[];
}

export interface MockDrillRequest {
  lotId: number;
  drillName?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface RecallListParams {
  status?: RecallStatus;
  recallClass?: RecallClass;
  productId?: number;
  page?: number;
  limit?: number;
}

export interface RecallListResponse {
  recalls: Recall[];
  total: number;
}

export interface RecallCloseRequest {
  effectivenessAssessment?: string;
  regulatoryReportPath?: string;
}

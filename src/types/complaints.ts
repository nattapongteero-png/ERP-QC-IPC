// Complaints Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 9)

// ============================================
// Enums
// ============================================

export type ComplaintSource = 'customer' | 'distributor' | 'regulatory' | 'internal';

export type ComplaintCategory = 'quality' | 'efficacy' | 'safety' | 'packaging' | 'labeling' | 'other';

export type ComplaintSeverity = 'minor' | 'major' | 'critical';

export type ComplaintStatus = 'received' | 'under_investigation' | 'resolved' | 'closed';

// ============================================
// Complaints
// ============================================

export interface Complaint {
  id: number;
  complaintNumber: string;
  receivedDate: string;
  source: ComplaintSource;
  customerName: string | null;
  customerContact: string | null;
  productId: number;
  productName?: string;
  lotId: number | null;
  lotNumber?: string;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  description: string;
  status: ComplaintStatus;
  regulatoryReportRequired: boolean;
  regulatoryReportDate: string | null;
  capaId: number | null;
  capaNumber?: string;
  recallRequired: boolean;
  recallId: number | null;
  recallNumber?: string;
  closedDate: string | null;
  closedBy: number | null;
  closedByName?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintCreate {
  receivedDate: string;
  source: ComplaintSource;
  customerName?: string;
  customerContact?: string;
  productId: number;
  lotId?: number;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  description: string;
}

export interface ComplaintUpdate {
  status?: ComplaintStatus;
  severity?: ComplaintSeverity;
  regulatoryReportRequired?: boolean;
  regulatoryReportDate?: string | null;
}

export interface ComplaintDetails extends Complaint {
  investigation: ComplaintInvestigation | null;
  capa?: object; // Linked CAPA summary
  recall?: object; // Linked recall summary
}

// ============================================
// Complaint Investigations
// ============================================

export interface ComplaintInvestigation {
  id: number;
  complaintId: number;
  investigatorId: number;
  investigatorName?: string;
  startDate: string;
  completionDate: string | null;
  batchRecordReview: string | null;
  retainSampleTest: string | null;
  rootCause: string;
  conclusion: string;
  recommendation: string | null;
}

export interface ComplaintInvestigationCreate {
  batchRecordReview?: string;
  retainSampleTest?: string;
  rootCause: string;
  conclusion: string;
  recommendation?: string;
}

// ============================================
// Complaint Trends
// ============================================

export interface ComplaintTrends {
  period: string;
  dataPoints: Array<{
    label: string;
    count: number;
  }>;
  byCategory: Record<ComplaintCategory, number>;
  byProduct: Array<{
    productId: number;
    productName: string;
    count: number;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ComplaintListParams {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  severity?: ComplaintSeverity;
  productId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ComplaintListResponse {
  complaints: Complaint[];
  total: number;
}

export interface ComplaintCloseRequest {
  closureNotes?: string;
}

export interface ComplaintTrendsParams {
  period?: 'month' | 'quarter' | 'year';
  groupBy?: 'category' | 'product' | 'severity';
}

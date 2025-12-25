/**
 * PQR (Product Quality Review) Types
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Types for managing annual product quality reviews as required by Thai FDA GMP.
 */

// ============================================
// Enums & Constants
// ============================================

export type PqrStatus = 'draft' | 'under_review' | 'approved';

export type MetricType =
  | 'deviation_rate'
  | 'capa_closure_rate'
  | 'oos_rate'
  | 'complaint_rate'
  | 'recall_rate'
  | 'batch_success_rate'
  | 'yield_average'
  | 'stability_compliance';

export type MetricStatus = 'pass' | 'fail' | 'warning';

// ============================================
// Core Types
// ============================================

export interface PqrReport {
  id: number;
  reportNumber: string; // PQR-YYYY-###
  productId: number | null;
  productName?: string;
  productCode?: string;
  reviewYear: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: PqrStatus;
  batchesProduced: number;
  deviationCount: number;
  capaCount: number;
  complaintCount: number;
  oosCount: number;
  recallCount: number;
  stabilityStatus: string | null;
  conclusions: string | null;
  recommendations: string | null;
  approvedBy: number | null;
  approvedByName?: string;
  approvedAt: string | null;
  createdBy: number | null;
  createdByName?: string;
  createdAt: string;
}

export interface PqrMetric {
  id: number;
  pqrId: number;
  metricType: MetricType;
  metricValue: number | null;
  target: number | null;
  status: MetricStatus;
  details: string | null; // JSON supporting data
  calculatedAt: string;
}

export interface PqrReportWithMetrics extends PqrReport {
  metrics: PqrMetric[];
}

// ============================================
// API Types
// ============================================

export interface PqrCreate {
  productId: number;
  reviewYear: number;
  periodStart?: string;
  periodEnd?: string;
  batchesProduced?: number;
  deviationCount?: number;
  capaCount?: number;
  complaintCount?: number;
  oosCount?: number;
  recallCount?: number;
  stabilityStatus?: string;
  conclusions?: string;
  recommendations?: string;
}

export interface PqrUpdate extends Partial<PqrCreate> {
  status?: PqrStatus;
}

// ============================================
// Dashboard Types
// ============================================

export interface PqrDashboard {
  totalReports: number;
  byStatus: Record<PqrStatus, number>;
  byYear: { year: number; count: number }[];
  pendingReview: number;
  approvedThisYear: number;
  averageMetrics: {
    deviationRate: number | null;
    capaClosureRate: number | null;
    oosRate: number | null;
    complaintRate: number | null;
  };
  recentReports: PqrReport[];
}

export interface PqrTrends {
  period: string;
  dataPoints: {
    year: number;
    label: string;
    reportsCount: number;
    avgDeviationRate: number | null;
    avgOosRate: number | null;
  }[];
  byProduct: {
    productId: number;
    productName: string;
    reportCount: number;
    lastReviewYear: number;
  }[];
}

// ============================================
// Labels & Display
// ============================================

export const PQR_STATUS_LABELS: Record<PqrStatus, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  approved: 'Approved',
};

export const PQR_STATUS_COLORS: Record<PqrStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  under_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
};

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  deviation_rate: 'Deviation Rate',
  capa_closure_rate: 'CAPA Closure Rate',
  oos_rate: 'OOS Rate',
  complaint_rate: 'Complaint Rate',
  recall_rate: 'Recall Rate',
  batch_success_rate: 'Batch Success Rate',
  yield_average: 'Average Yield',
  stability_compliance: 'Stability Compliance',
};

export const METRIC_STATUS_COLORS: Record<MetricStatus, string> = {
  pass: 'text-green-600',
  fail: 'text-red-600',
  warning: 'text-amber-600',
};

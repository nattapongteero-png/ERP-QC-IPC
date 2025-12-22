// Stability Program Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)

// ============================================
// Enums
// ============================================

export type StabilityStudyType = 'long_term' | 'accelerated' | 'intermediate';

export type StabilityProtocolStatus = 'draft' | 'approved' | 'obsolete';

export type StabilityStudyStatus = 'active' | 'completed' | 'cancelled' | 'on_hold';

export type StabilitySampleStatus = 'pending' | 'sampled' | 'tested' | 'skipped';

// ============================================
// Stability Protocols
// ============================================

export interface StabilityProtocol {
  id: number;
  protocolNumber: string;
  name: string;
  productId: number;
  productName?: string;
  studyType: StabilityStudyType;
  storageCondition: string; // e.g., "25°C/60%RH"
  timepoints: number[]; // Months from start, e.g., [0, 1, 2, 3, 6, 9, 12, 18, 24, 36]
  testsRequired: Array<{
    testId: number;
    testName?: string;
  }>;
  status: StabilityProtocolStatus;
  approvedBy: number | null;
  approvedByName?: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface StabilityProtocolCreate {
  name: string;
  productId: number;
  studyType: StabilityStudyType;
  storageCondition: string;
  timepoints: number[];
  testsRequired: number[]; // Quality spec IDs
}

export interface StabilityProtocolUpdate {
  name?: string;
  storageCondition?: string;
  timepoints?: number[];
  testsRequired?: number[];
  status?: 'draft' | 'obsolete';
}

// ============================================
// Stability Studies
// ============================================

export interface StabilityStudy {
  id: number;
  studyNumber: string;
  protocolId: number;
  protocolNumber?: string;
  lotId: number;
  lotNumber?: string;
  productId: number;
  productName?: string;
  startDate: string;
  endDate: string | null;
  status: StabilityStudyStatus;
  chamberLocation: string | null;
  currentTimepoint: number | null; // Most recent completed timepoint
  nextDueDate: string | null;
  oosCount: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
}

export interface StabilityStudyCreate {
  protocolId: number;
  lotId: number;
  startDate: string;
  chamberLocation?: string;
  notes?: string;
}

export interface StabilityStudyUpdate {
  status?: StabilityStudyStatus;
  chamberLocation?: string;
  notes?: string;
}

export interface StabilityStudyDetails extends StabilityStudy {
  protocol: StabilityProtocol;
  samples: StabilitySample[];
  trends: TrendParameter[];
}

// ============================================
// Stability Samples
// ============================================

export interface StabilitySample {
  id: number;
  studyId: number;
  sampleNumber: string;
  timepoint: number; // Months from study start
  scheduledDate: string;
  actualDate: string | null;
  status: StabilitySampleStatus;
  qualityTestId: number | null;
  oosDetected: boolean;
  oosInvestigationId: number | null;
  sampledBy: number | null;
  sampledByName?: string;
  notes: string | null;
}

export interface StabilitySampleUpdate {
  status?: StabilitySampleStatus;
  actualDate?: string;
  notes?: string;
}

export interface RecordTestRequest {
  qualityTestId: number; // Link to quality_tests table result
  oosDetected?: boolean;
  notes?: string;
}

// ============================================
// Sample Alerts
// ============================================

export interface SampleAlert {
  sampleId: number;
  studyId: number;
  studyNumber: string;
  productName: string;
  lotNumber: string;
  timepoint: number;
  scheduledDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

// ============================================
// Trend Analysis
// ============================================

export interface TrendParameter {
  parameter: string;
  unit: string;
  specification: {
    min?: number;
    max?: number;
  };
  dataPoints: Array<{
    timepoint: number;
    value: number;
    date: string;
  }>;
  trendSlope: number;
  projectedFailureMonth: number | null;
}

export interface StabilityTrends {
  totalActiveStudies: number;
  overduesamples: number;
  oosThisMonth: number;
  studiesByProduct: Array<{
    productId: number;
    productName: string;
    activeStudies: number;
    completedStudies: number;
  }>;
}

export interface StudyTrendData {
  studyId: number;
  studyNumber: string;
  parameters: TrendParameter[];
  projections: Array<{
    parameter: string;
    projectedValue: number;
    atMonth: number;
    withinSpec: boolean;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface StabilityProtocolListParams {
  productId?: number;
  studyType?: StabilityStudyType;
  status?: StabilityProtocolStatus;
}

export interface StabilityStudyListParams {
  protocolId?: number;
  productId?: number;
  status?: StabilityStudyStatus;
  page?: number;
  limit?: number;
}

export interface StabilityStudyListResponse {
  studies: StabilityStudy[];
  total: number;
}

export interface StabilitySampleListParams {
  studyId?: number;
  status?: StabilitySampleStatus;
  dueSoon?: boolean; // Filter to samples due within 30 days
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface StabilitySampleListResponse {
  samples: StabilitySample[];
  total: number;
}

export interface StabilityTrendsParams {
  studyId?: number;
  productId?: number;
}

export interface StudyTrendDataParams {
  parameter?: string; // Specific test parameter to chart
}

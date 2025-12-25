// Sanitation & Pest Control Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 4)

// ============================================
// Enums
// ============================================

export type AreaType = 'production' | 'warehouse' | 'lab' | 'office';

export type SanitationFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type SanitationLogStatus = 'completed' | 'partial' | 'missed';

export type PestControlServiceType = 'routine' | 'emergency' | 'follow_up';

// ============================================
// Sanitation Schedules
// ============================================

export interface SanitationSchedule {
  id: number;
  name: string;
  areaType: AreaType;
  areaId: number | null;
  areaName?: string;
  equipmentId: number | null;
  equipmentName?: string;
  frequency: SanitationFrequency;
  dayOfWeek: number | null; // 0-6 for weekly
  dayOfMonth: number | null; // 1-31 for monthly
  method: string;
  verificationRequired: boolean;
  isActive: boolean;
  lastCompleted: string | null;
  nextDue: string | null;
  complianceRate?: number; // Percentage of on-time completions
  createdAt: string;
}

export interface SanitationScheduleCreate {
  name: string;
  areaType: AreaType;
  areaId?: number;
  equipmentId?: number;
  frequency: SanitationFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  method: string;
  verificationRequired?: boolean;
}

export interface SanitationScheduleUpdate {
  name?: string;
  method?: string;
  verificationRequired?: boolean;
  isActive?: boolean;
}

// ============================================
// Sanitation Logs
// ============================================

export interface SanitationLog {
  id: number;
  scheduleId: number;
  scheduleName?: string;
  areaType: AreaType;
  scheduledDate: string;
  performedDate: string;
  performedBy: number;
  performedByName?: string;
  method: string;
  chemicalsUsed: string | null;
  status: SanitationLogStatus;
  verifiedBy: number | null;
  verifiedByName?: string;
  verifiedAt: string | null;
  deviationId: number | null;
  notes: string | null;
  createdAt: string;
}

export interface SanitationLogCreate {
  scheduleId: number;
  scheduledDate?: string;
  performedDate: string;
  method?: string;
  chemicalsUsed?: string;
  status: SanitationLogStatus;
  notes?: string;
}

export interface SanitationLogUpdate {
  status?: SanitationLogStatus;
  notes?: string;
}

// ============================================
// Pest Control Logs
// ============================================

export interface PestControlLog {
  id: number;
  serviceDate: string;
  contractorName: string;
  technicianName: string | null;
  serviceType: PestControlServiceType;
  areasServiced: string[]; // Array of area names
  treatmentMethod: string | null;
  findingsCount: number;
  findings: string | null;
  recommendations: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  verifiedBy: number | null;
  verifiedByName?: string;
  createdAt: string;
}

export interface PestControlLogCreate {
  serviceDate: string;
  contractorName: string;
  technicianName?: string;
  serviceType: PestControlServiceType;
  areasServiced: string[];
  treatmentMethod?: string;
  findingsCount?: number;
  findings?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
}

export interface PestControlLogUpdate {
  findings?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  followUpDate?: string | null;
}

// ============================================
// Pending Tasks
// ============================================

export interface PendingTask {
  scheduleId: number;
  scheduleName: string;
  areaType: AreaType;
  areaName: string;
  frequency: SanitationFrequency;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
}

// ============================================
// Sanitation Trends
// ============================================

export interface SanitationTrends {
  period: string;
  overallComplianceRate: number;
  byArea: Array<{
    areaType: AreaType;
    complianceRate: number;
    completedCount: number;
    missedCount: number;
  }>;
  pestActivityTrend: Array<{
    period: string;
    findingsCount: number;
  }>;
  dataPoints: Array<{
    date: string;
    completed: number;
    missed: number;
    complianceRate: number;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface SanitationScheduleListParams {
  areaType?: AreaType;
  frequency?: SanitationFrequency;
  isActive?: boolean;
}

export interface SanitationLogListParams {
  scheduleId?: number;
  areaType?: AreaType;
  status?: SanitationLogStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface SanitationLogListResponse {
  logs: SanitationLog[];
  total: number;
}

export interface PestControlLogListParams {
  serviceType?: PestControlServiceType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface PestControlLogListResponse {
  logs: PestControlLog[];
  total: number;
}

export interface SanitationTrendsParams {
  period?: 'week' | 'month' | 'quarter' | 'year';
  areaType?: AreaType;
}

// ============================================
// Due Dates Generation (T802)
// ============================================

export interface DueDateRange {
  startDate?: string;
  endDate?: string;
}

export interface GeneratedDueDate {
  scheduleId: number;
  scheduleName: string;
  areaType: AreaType;
  frequency: SanitationFrequency;
  dueDate: string;
}

// ============================================
// Pest Control Trends (T806)
// ============================================

export interface PestControlTrendsParams {
  period?: 'week' | 'month' | 'quarter' | 'year';
  areaType?: AreaType;
}

export interface PestControlTrends {
  period: string;
  totalServices: number;
  averageFindingsPerService: number;
  followUpRate: number; // Percentage of services requiring follow-up
  byServiceType: Array<{
    serviceType: PestControlServiceType;
    serviceCount: number;
    averageFindings: number;
  }>;
  dataPoints: Array<{
    date: string;
    serviceCount: number;
    findingsCount: number;
  }>;
}

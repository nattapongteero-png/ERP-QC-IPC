// Manufacturing Contracts Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 8)

// ============================================
// Enums
// ============================================

export type ContractorType = 'manufacturer' | 'laboratory' | 'both';

export type ContractStatus = 'active' | 'expired' | 'terminated' | 'pending';

export type ContractActivityType = 'manufacturing' | 'testing' | 'packaging';

// ============================================
// Manufacturing Contracts
// ============================================

export interface ManufacturingContract {
  id: number;
  contractNumber: string;
  contractorName: string;
  contractorType: ContractorType;
  scope: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  status: ContractStatus;
  qualityAgreementPath: string | null;
  lastAuditDate: string | null;
  nextAuditDue: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  // Computed fields
  daysUntilExpiry?: number;
  batchCount?: number;
  isExpiringSoon?: boolean;
  isAuditOverdue?: boolean;
}

export interface ContractCreate {
  contractorName: string;
  contractorType: ContractorType;
  scope?: string;
  effectiveDate?: string;
  expirationDate?: string;
  qualityAgreementPath?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface ContractUpdate {
  contractorName?: string;
  contractorType?: ContractorType;
  scope?: string;
  effectiveDate?: string;
  expirationDate?: string;
  status?: ContractStatus;
  qualityAgreementPath?: string;
  lastAuditDate?: string;
  nextAuditDue?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

// ============================================
// Contract Batches
// ============================================

export interface ContractBatch {
  id: number;
  contractId: number;
  contractNumber?: string;
  contractorName?: string;
  lotId: number | null;
  lotNumber?: string;
  productName?: string;
  activityType: ContractActivityType;
  activityDescription: string | null;
  performedDate: string | null;
  certificatePath: string | null;
  verifiedBy: number | null;
  verifiedByName?: string;
  createdAt: string;
}

export interface ContractBatchCreate {
  contractId: number;
  lotId?: number;
  activityType: ContractActivityType;
  activityDescription?: string;
  performedDate?: string;
  certificatePath?: string;
}

export interface ContractBatchUpdate {
  lotId?: number;
  activityType?: ContractActivityType;
  activityDescription?: string;
  performedDate?: string;
  certificatePath?: string;
  verifiedBy?: number;
}

// ============================================
// Dashboard & Trends
// ============================================

export interface ContractDashboard {
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  terminatedContracts: number;
  pendingContracts: number;
  expiringSoon: number; // within 90 days
  auditsOverdue: number;
  totalBatches: number;
  batchesThisMonth: number;
  byContractorType: Record<ContractorType, number>;
  byActivityType: Record<ContractActivityType, number>;
  topContractors: Array<{
    contractorName: string;
    contractId: number;
    batchCount: number;
    status: ContractStatus;
  }>;
  expiringContracts: ManufacturingContract[];
  overdueAudits: ManufacturingContract[];
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

export interface ContractTrends {
  period: string;
  byStatus: Record<ContractStatus, number>;
  byType: Record<ContractorType, number>;
  activityByMonth: Array<{
    month: string;
    manufacturing: number;
    testing: number;
    packaging: number;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ContractListParams {
  status?: ContractStatus;
  contractorType?: ContractorType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ContractListResponse {
  contracts: ManufacturingContract[];
  total: number;
}

export interface ContractBatchListParams {
  contractId?: number;
  activityType?: ContractActivityType;
  page?: number;
  limit?: number;
}

export interface ContractBatchListResponse {
  batches: ContractBatch[];
  total: number;
}

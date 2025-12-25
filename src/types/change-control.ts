/**
 * Change Control Types
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 */

// Change Request Types
export type ChangeType = 'process' | 'equipment' | 'document' | 'supplier' | 'formula' | 'other';
export type ChangePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ChangeStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'implemented' | 'closed';

// Approval Types
export type ApprovalRole = 'qa' | 'production' | 'regulatory' | 'management';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Base Change Request
export interface ChangeRequest {
  id: number;
  changeNumber: string;
  title: string;
  changeType: ChangeType;
  description: string | null;
  justification: string | null;
  impactAssessment: string | null;
  riskAssessment: string | null;
  status: ChangeStatus;
  priority: ChangePriority;
  requesterId: number | null;
  requesterName?: string;
  ownerId: number | null;
  ownerName?: string;
  targetDate: string | null;
  implementedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// Change Approval
export interface ChangeApproval {
  id: number;
  changeId: number;
  approverId: number | null;
  approverName?: string;
  role: ApprovalRole;
  status: ApprovalStatus;
  comments: string | null;
  signedAt: string | null;
  createdAt: string;
}

// Change Request with Approvals
export interface ChangeRequestDetails extends ChangeRequest {
  approvals: ChangeApproval[];
}

// Create Change Request
export interface ChangeRequestCreate {
  title: string;
  changeType: ChangeType;
  description?: string;
  justification?: string;
  impactAssessment?: string;
  riskAssessment?: string;
  priority?: ChangePriority;
  ownerId: number;
  targetDate?: string;
}

// Update Change Request
export interface ChangeRequestUpdate {
  title?: string;
  description?: string;
  justification?: string;
  impactAssessment?: string;
  riskAssessment?: string;
  priority?: ChangePriority;
  ownerId?: number;
  targetDate?: string;
}

// List Filters
export interface ChangeRequestListParams {
  status?: ChangeStatus;
  changeType?: ChangeType;
  priority?: ChangePriority;
  ownerId?: number;
  page?: number;
  limit?: number;
}

export interface ChangeRequestListResponse {
  changes: ChangeRequest[];
  total: number;
}

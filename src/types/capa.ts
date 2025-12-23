// CAPA Management Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
// Enhanced for GMP Compliance: Risk Assessment, Impact Assessment, Approval Workflow, Attachments

// ============================================
// Enums
// ============================================

export type CapaSourceType = 'deviation' | 'complaint' | 'audit_finding' | 'other';

export type CapaType = 'corrective' | 'preventive' | 'both';

export type CapaPriority = 'low' | 'medium' | 'high' | 'critical';

export type CapaStatus = 'open' | 'investigation' | 'action_pending' | 'verification' | 'pending_approval' | 'closed' | 'cancelled';

export type CapaActionType = 'immediate' | 'corrective' | 'preventive';

export type CapaActionStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export type CapaEffectivenessResult = 'effective' | 'not_effective' | 'partial';

// Phase 1 Critical: Risk Assessment (ICH Q9 Compliant)
export type RiskSeverity = 'negligible' | 'minor' | 'moderate' | 'major' | 'critical';
export type RiskProbability = 'rare' | 'unlikely' | 'possible' | 'likely' | 'certain';

// Phase 1 Critical: Impact Assessment
export type ImpactScope = 'single_batch' | 'multiple_batches' | 'product_line' | 'facility' | 'multi_site';

// Phase 1 Critical: Approval Workflow
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_required';
export type ApprovalRole = 'owner' | 'qa_reviewer' | 'qa_manager' | 'plant_manager';

// Phase 1 Critical: Attachment Types
export type AttachmentType = 'evidence' | 'root_cause_report' | 'investigation_report' | 'sop_revision' | 'training_record' | 'photo' | 'lab_result' | 'other';

// ============================================
// CAPA
// ============================================

export interface Capa {
  id: number;
  capaNumber: string;
  title: string;
  sourceType: CapaSourceType;
  sourceId: number | null;
  sourceNumber?: string; // Deviation/Complaint/Finding number
  deviationId: number | null;
  complaintId: number | null;
  auditFindingId: number | null;
  type: CapaType;
  priority: CapaPriority;
  status: CapaStatus;
  rootCauseAnalysis: string | null;
  rootCauseCategory: string | null;
  dueDate: string | null;
  closedDate: string | null;
  ownerId: number;
  ownerName?: string;
  isOverdue?: boolean;
  actionCount?: number;
  actionsCompleted?: number;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;

  // Phase 1 Critical: Risk Assessment (ICH Q9)
  riskSeverity: RiskSeverity | null;
  riskProbability: RiskProbability | null;
  riskScore: number | null; // Calculated: severity * probability (1-25 scale)
  riskJustification: string | null;

  // Phase 1 Critical: Impact Assessment
  impactScope: ImpactScope | null;
  affectedProducts: string | null; // JSON array of product codes
  affectedBatches: string | null; // JSON array of batch numbers
  affectedProcesses: string | null; // JSON array of process names
  patientImpact: boolean;
  regulatoryNotificationRequired: boolean;
  regulatoryNotificationDate: string | null;
  regulatoryReferenceNumber: string | null;

  // Phase 1 Critical: Approval Workflow
  approvalStatus: ApprovalStatus | null;
  submittedForApprovalAt: string | null;
  submittedForApprovalBy: number | null;
  currentApprovalStep: ApprovalRole | null;
  closureNotes: string | null;
}

export interface CapaCreate {
  title: string;
  sourceType: CapaSourceType;
  sourceId?: number;
  type: CapaType;
  priority: CapaPriority;
  ownerId: number;
  dueDate: string;
  rootCauseAnalysis?: string;
  rootCauseCategory?: string;

  // Phase 1 Critical: Risk Assessment
  riskSeverity?: RiskSeverity;
  riskProbability?: RiskProbability;
  riskJustification?: string;

  // Phase 1 Critical: Impact Assessment
  impactScope?: ImpactScope;
  affectedProducts?: string[];
  affectedBatches?: string[];
  affectedProcesses?: string[];
  patientImpact?: boolean;
  regulatoryNotificationRequired?: boolean;
}

export interface CapaUpdate {
  title?: string;
  priority?: CapaPriority;
  status?: CapaStatus;
  rootCauseAnalysis?: string;
  rootCauseCategory?: string;
  dueDate?: string;
  ownerId?: number;

  // Phase 1 Critical: Risk Assessment
  riskSeverity?: RiskSeverity;
  riskProbability?: RiskProbability;
  riskJustification?: string;

  // Phase 1 Critical: Impact Assessment
  impactScope?: ImpactScope;
  affectedProducts?: string[];
  affectedBatches?: string[];
  affectedProcesses?: string[];
  patientImpact?: boolean;
  regulatoryNotificationRequired?: boolean;
  regulatoryNotificationDate?: string;
  regulatoryReferenceNumber?: string;
}

export interface CapaDetails extends Capa {
  actions: CapaAction[];
  effectivenessChecks: CapaEffectiveness[];
  attachments: CapaAttachment[];
  approvals: CapaApproval[];
  source?: object; // Details of source deviation/complaint/finding
}

// ============================================
// CAPA Actions
// ============================================

export interface CapaAction {
  id: number;
  capaId: number;
  actionNumber: number;
  description: string;
  actionType: CapaActionType;
  assigneeId: number;
  assigneeName?: string;
  dueDate: string | null;
  status: CapaActionStatus;
  completionNotes: string | null;
  completedAt: string | null;
  verifiedBy: number | null;
  verifiedByName?: string;
  verifiedAt: string | null;
}

export interface CapaActionCreate {
  description: string;
  actionType: CapaActionType;
  assigneeId: number;
  dueDate: string;
}

export interface CapaActionUpdate {
  status?: CapaActionStatus;
  completionNotes?: string;
  dueDate?: string;
}

// ============================================
// CAPA Effectiveness
// ============================================

export interface CapaEffectiveness {
  id: number;
  capaId: number;
  checkNumber: number;
  checkDate: string;
  verifierId: number;
  verifierName?: string;
  criteria: string;
  result: CapaEffectivenessResult;
  evidence: string | null;
  followUpRequired: boolean;
  notes: string | null;
}

export interface CapaEffectivenessCreate {
  checkDate?: string;
  criteria: string;
  result: CapaEffectivenessResult;
  evidence?: string;
  followUpRequired?: boolean;
  notes?: string;
}

// ============================================
// CAPA Dashboard
// ============================================

export interface CapaDashboard {
  totalOpen: number;
  byStatus: Record<CapaStatus, number>;
  byPriority: Record<CapaPriority, number>;
  overdue: number;
  closedThisMonth: number;
  avgClosureTime: number; // Average days to close
  effectivenessRate: number; // Percentage deemed effective
}

// ============================================
// API Request/Response Types
// ============================================

export interface CapaListParams {
  status?: CapaStatus;
  type?: CapaType;
  priority?: CapaPriority;
  sourceType?: CapaSourceType;
  ownerId?: number;
  overdue?: boolean;
  page?: number;
  limit?: number;
}

export interface CapaListResponse {
  capas: Capa[];
  total: number;
}

export interface CapaCloseRequest {
  closureNotes?: string;
}

// ============================================
// Phase 1 Critical: CAPA Attachments
// ============================================

export interface CapaAttachment {
  id: number;
  capaId: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  attachmentType: AttachmentType;
  description: string | null;
  uploadedBy: number;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface CapaAttachmentCreate {
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  attachmentType: AttachmentType;
  description?: string;
}

// ============================================
// Phase 1 Critical: CAPA Approval Workflow
// ============================================

export interface CapaApproval {
  id: number;
  capaId: number;
  approverRole: ApprovalRole;
  approverId: number | null;
  approverName?: string;
  status: ApprovalStatus;
  comments: string | null;
  signedAt: string | null;
  signatureHash: string | null; // Electronic signature hash
  createdAt: string;
  updatedAt: string;
}

export interface CapaApprovalCreate {
  approverRole: ApprovalRole;
  approverId?: number;
}

export interface CapaApprovalUpdate {
  status: ApprovalStatus;
  comments?: string;
}

// Submit for approval request
export interface CapaSubmitForApprovalRequest {
  closureNotes?: string;
}

// Approval action request (approve/reject)
export interface CapaApprovalActionRequest {
  action: 'approve' | 'reject' | 'request_revision';
  comments?: string;
  signaturePassword?: string; // For electronic signature verification
}

// ============================================
// Phase 1 Critical: Risk Matrix Helpers
// ============================================

// Risk score calculation: Severity (1-5) × Probability (1-5) = Score (1-25)
export const RISK_SEVERITY_VALUES: Record<RiskSeverity, number> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  critical: 5,
};

export const RISK_PROBABILITY_VALUES: Record<RiskProbability, number> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  certain: 5,
};

// Risk classification based on score
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function calculateRiskScore(severity: RiskSeverity, probability: RiskProbability): number {
  return RISK_SEVERITY_VALUES[severity] * RISK_PROBABILITY_VALUES[probability];
}

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 4) return 'low';       // 1-4
  if (score <= 9) return 'medium';    // 5-9
  if (score <= 16) return 'high';     // 10-16
  return 'critical';                   // 17-25
}

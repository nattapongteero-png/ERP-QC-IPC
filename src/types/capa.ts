// CAPA Management Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 1)

// ============================================
// Enums
// ============================================

export type CapaSourceType = 'deviation' | 'complaint' | 'audit_finding' | 'other';

export type CapaType = 'corrective' | 'preventive' | 'both';

export type CapaPriority = 'low' | 'medium' | 'high' | 'critical';

export type CapaStatus = 'open' | 'investigation' | 'action_pending' | 'verification' | 'closed' | 'cancelled';

export type CapaActionType = 'immediate' | 'corrective' | 'preventive';

export type CapaActionStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export type CapaEffectivenessResult = 'effective' | 'not_effective' | 'partial';

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
}

export interface CapaUpdate {
  title?: string;
  priority?: CapaPriority;
  status?: CapaStatus;
  rootCauseAnalysis?: string;
  rootCauseCategory?: string;
  dueDate?: string;
  ownerId?: number;
}

export interface CapaDetails extends Capa {
  actions: CapaAction[];
  effectivenessChecks: CapaEffectiveness[];
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

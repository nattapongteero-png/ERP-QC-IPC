// Internal Audit Module - TypeScript Types
// Feature: 009-gmp-compliance-gap-analysis (หมวด 10)

// ============================================
// Enums
// ============================================

export type AuditPlanStatus = 'draft' | 'approved' | 'in_progress' | 'completed';

export type AuditType = 'internal' | 'external' | 'regulatory';

export type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type AuditFindingCategory = 'observation' | 'minor' | 'major' | 'critical';

export type AuditFindingStatus = 'open' | 'capa_assigned' | 'closed';

// ============================================
// Audit Plans
// ============================================

export interface AuditPlan {
  id: number;
  planYear: number;
  name: string;
  status: AuditPlanStatus;
  totalAudits: number;
  completedAudits: number;
  approvedBy: number | null;
  approvedByName?: string;
  approvedAt: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
}

export interface AuditPlanCreate {
  planYear: number;
  name: string;
}

export interface AuditPlanUpdate {
  name?: string;
  status?: 'draft' | 'in_progress' | 'completed';
}

// ============================================
// Audits
// ============================================

export interface Audit {
  id: number;
  auditNumber: string;
  planId: number | null;
  auditType: AuditType;
  scope: string;
  gmpChapters: number[]; // หมวด covered (1-10)
  objectives?: string | null; // Audit objectives
  scheduledDate: string;
  actualDate: string | null;
  startedAt?: string | null; // When audit started
  completedAt?: string | null; // When audit completed
  leadAuditorId: number;
  leadAuditorName?: string;
  auditTeam: number[]; // User IDs
  auditTeamNames?: string[];
  status: AuditStatus;
  findingsCount: number;
  openFindingsCount: number;
  summary: string | null;
  reportPath: string | null;
  closedDate: string | null;
  createdAt: string;
}

export interface AuditCreate {
  planId?: number;
  auditType: AuditType;
  scope: string;
  gmpChapters: number[];
  scheduledDate: string;
  leadAuditorId: number;
  auditTeam?: number[];
}

export interface AuditUpdate {
  scope?: string;
  scheduledDate?: string;
  leadAuditorId?: number;
  auditTeam?: number[];
  status?: 'scheduled' | 'in_progress' | 'cancelled';
}

export interface AuditDetails extends Audit {
  findings: AuditFinding[];
  plan: AuditPlan | null;
}

export interface AuditCompleteRequest {
  summary?: string;
  reportPath?: string;
}

// ============================================
// Audit Findings
// ============================================

export interface AuditFinding {
  id: number;
  auditId: number;
  auditNumber?: string;
  findingNumber: string; // F-001, F-002 within audit
  category: AuditFindingCategory;
  gmpChapter: number; // หมวด reference (1-10)
  gmpChapterName?: string;
  gmpRequirement: string | null;
  description: string;
  evidence: string | null;
  areaOwner: number | null;
  areaOwnerName?: string;
  capaRequired: boolean;
  capaId: number | null;
  capaNumber?: string;
  status: AuditFindingStatus;
  closedDate: string | null;
  closedBy: number | null;
  closedByName?: string;
  createdAt: string;
}

export interface AuditFindingCreate {
  auditId: number;
  category: AuditFindingCategory;
  gmpChapter: number;
  gmpRequirement?: string;
  description: string;
  evidence?: string;
  areaOwner?: number;
  capaRequired?: boolean;
}

export interface AuditFindingUpdate {
  category?: AuditFindingCategory;
  description?: string;
  evidence?: string;
  areaOwner?: number;
  capaRequired?: boolean;
}

export interface CreateCapaFromFindingRequest {
  ownerId: number;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditFindingCloseRequest {
  closureNotes?: string;
}

// ============================================
// Audit Statistics
// ============================================

export interface AuditStatistics {
  year: number;
  totalPlanned: number;
  totalCompleted: number;
  completionRate: number;
  totalFindings: number;
  findingsByCategory: {
    observation: number;
    minor: number;
    major: number;
    critical: number;
  };
  openFindings: number;
  avgCapaClosureTime: number; // Average days to close findings
}

export interface ChapterCoverage {
  year: number;
  chapters: Array<{
    chapter: number;
    name: string;
    auditsPlanned: number;
    auditsCompleted: number;
    findingsCount: number;
    lastAuditDate: string | null;
  }>;
}

// GMP Chapter names in Thai
export const GMP_CHAPTERS: Record<number, string> = {
  1: 'หมวด 1 - ระบบบริหารคุณภาพ',
  2: 'หมวด 2 - บุคลากร',
  3: 'หมวด 3 - อาคารสถานที่และเครื่องมือ',
  4: 'หมวด 4 - การสุขาภิบาลและสุขอนามัย',
  5: 'หมวด 5 - เอกสารและข้อมูล',
  6: 'หมวด 6 - การดำเนินการผลิต',
  7: 'หมวด 7 - การควบคุมคุณภาพ',
  8: 'หมวด 8 - การจ้างผลิตและจ้างตรวจวิเคราะห์',
  9: 'หมวด 9 - ข้อร้องเรียนและการเรียกคืน',
  10: 'หมวด 10 - การตรวจสอบตนเอง',
};

// ============================================
// API Request/Response Types
// ============================================

export interface AuditPlanListParams {
  year?: number;
  status?: AuditPlanStatus;
}

export interface AuditListParams {
  planId?: number;
  auditType?: AuditType;
  status?: AuditStatus;
  gmpChapter?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditListResponse {
  audits: Audit[];
  total: number;
}

export interface AuditFindingListParams {
  auditId?: number;
  category?: AuditFindingCategory;
  gmpChapter?: number;
  status?: AuditFindingStatus;
  page?: number;
  limit?: number;
}

export interface AuditFindingListResponse {
  findings: AuditFinding[];
  total: number;
}

export interface AuditReportsParams {
  year?: number;
}
